import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowctlContext } from "@/cli/context";
import { runCursorDispatch } from "@/commands/cursor-dispatch";
import { runStart } from "@/commands/start";
import { initStateFile, setPath } from "@/state/writer";
import { refreshRuntimePaths } from "@/config/paths";
import {
  collectMcpHealthIssues,
  hasWarnedToday,
  mcpHealthMarker,
  recordWarnedToday,
  runMcpHealthCheck,
  shellProxyHasFlowctlHome,
  shouldSkipMcpHealth,
} from "@/utils/mcp-health";

describe("mcp-health", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("shouldSkipMcpHealth", () => {
    it("returns true when WF_SKIP_MCP_HEALTH=1", () => {
      expect(shouldSkipMcpHealth({ WF_SKIP_MCP_HEALTH: "1" })).toBe(true);
    });

    it("returns false when skip env unset", () => {
      expect(shouldSkipMcpHealth({})).toBe(false);
    });
  });

  describe("shellProxyHasFlowctlHome", () => {
    it("returns true when shell-proxy env includes FLOWCTL_HOME", () => {
      expect(
        shellProxyHasFlowctlHome({
          mcpServers: {
            "shell-proxy": { env: { FLOWCTL_HOME: "/home/flowctl" } },
          },
        }),
      ).toBe(true);
    });

    it("returns false when shell-proxy env omits FLOWCTL_HOME", () => {
      expect(
        shellProxyHasFlowctlHome({
          mcpServers: {
            "shell-proxy": { command: "flowctl", args: ["mcp", "--shell-proxy"] },
          },
        }),
      ).toBe(false);
    });
  });

  describe("collectMcpHealthIssues", () => {
    it("reports missing .cursor/mcp.json", async () => {
      const issues = await collectMcpHealthIssues({
        mcpJsonPath: "/proj/.cursor/mcp.json",
        eventsFile: "/cache/events.jsonl",
        mcpJsonExists: false,
        eventsNonEmpty: true,
      });
      expect(issues).toEqual([
        ".cursor/mcp.json chưa có — MCP servers chưa được cấu hình cho project này.",
      ]);
    });

    it("reports shell-proxy missing FLOWCTL_HOME when mcp.json exists", async () => {
      const issues = await collectMcpHealthIssues({
        mcpJsonPath: "/proj/.cursor/mcp.json",
        eventsFile: "/cache/events.jsonl",
        mcpJsonExists: true,
        mcpJson: {
          mcpServers: {
            "shell-proxy": { command: "flowctl", args: ["mcp", "--shell-proxy"] },
          },
        },
        eventsNonEmpty: true,
      });
      expect(issues).toEqual([
        "shell-proxy trong `.cursor/mcp.json` thiếu `FLOWCTL_HOME` → cache ghi sai đường dẫn, token savings không hoạt động.",
      ]);
    });

    it("reports empty events.jsonl", async () => {
      const issues = await collectMcpHealthIssues({
        mcpJsonPath: "/proj/.cursor/mcp.json",
        eventsFile: "/cache/events.jsonl",
        mcpJsonExists: true,
        mcpJson: {
          mcpServers: {
            "shell-proxy": { env: { FLOWCTL_HOME: "/home/flowctl" } },
          },
        },
        eventsNonEmpty: false,
      });
      expect(issues).toEqual([
        "MCP shell-proxy chưa có tool call nào được ghi nhận (`events.jsonl` trống) — workers có thể đang bỏ qua `wf_state()`/`wf_step_context()` và dùng bash thay thế.",
      ]);
    });

    it("returns no issues when mcp.json and events are healthy", async () => {
      const issues = await collectMcpHealthIssues({
        mcpJsonPath: "/proj/.cursor/mcp.json",
        eventsFile: "/cache/events.jsonl",
        mcpJsonExists: true,
        mcpJson: {
          mcpServers: {
            "shell-proxy": { env: { FLOWCTL_HOME: "/home/flowctl" } },
          },
        },
        eventsNonEmpty: true,
      });
      expect(issues).toEqual([]);
    });

    it("accumulates multiple issues", async () => {
      const issues = await collectMcpHealthIssues({
        mcpJsonPath: "/proj/.cursor/mcp.json",
        eventsFile: "/cache/events.jsonl",
        mcpJsonExists: true,
        mcpJson: { mcpServers: { "shell-proxy": {} } },
        eventsNonEmpty: false,
      });
      expect(issues).toHaveLength(2);
    });
  });

  describe("dedup marker", () => {
    it("mcpHealthMarker is stable per day", () => {
      expect(mcpHealthMarker("2026-05-16")).toBe("2026-05-16 mcp-health");
    });

    it("hasWarnedToday reads seen-mcp-warnings.txt", async () => {
      const home = await mkdtemp(join(tmpdir(), "flowctl-mcp-warn-"));
      await mkdir(home, { recursive: true });
      await writeFile(
        join(home, "seen-mcp-warnings.txt"),
        "2026-05-16 mcp-health\n",
        "utf-8",
      );
      expect(await hasWarnedToday(home, "2026-05-16")).toBe(true);
      expect(await hasWarnedToday(home, "2026-05-17")).toBe(false);
    });

    it("recordWarnedToday appends marker", async () => {
      const home = await mkdtemp(join(tmpdir(), "flowctl-mcp-warn-"));
      await recordWarnedToday(home, "2026-05-16");
      const raw = await readFile(join(home, "seen-mcp-warnings.txt"), "utf-8");
      expect(raw).toContain("2026-05-16 mcp-health");
    });
  });

  describe("runMcpHealthCheck", () => {
    function minimalCtx(
      projectRoot: string,
      flowctlHome: string,
      eventsFile: string,
    ): FlowctlContext {
      return {
        projectRoot,
        workflowRoot: projectRoot,
        stateFile: null,
        resolveSource: "env_state_file",
        paths: {
          flowctlHome,
          dataDir: join(flowctlHome, "data"),
          cacheDir: join(flowctlHome, "cache"),
          runtimeDir: join(flowctlHome, "runtime"),
          stateFile: null,
          idempotencyFile: "",
          roleSessionsFile: "",
          heartbeatsFile: "",
          budgetStateFile: "",
          budgetEventsFile: "",
          eventsFile,
          statsFile: "",
          traceabilityFile: "",
          evidenceDir: "",
          releaseDashboardDir: "",
          dispatchBase: "",
          gateReportsDir: "",
          retroDir: "",
          workflowLockDir: "",
          rolePolicyFile: "",
          budgetPolicyFile: "",
          qaGateFile: "",
          registryFile: "",
        },
      };
    }

    it("no-ops when WF_SKIP_MCP_HEALTH=1", async () => {
      const lines: string[] = [];
      const root = await mkdtemp(join(tmpdir(), "flowctl-mcp-run-"));
      await runMcpHealthCheck(minimalCtx(root, root, join(root, "events.jsonl")), {
        env: { WF_SKIP_MCP_HEALTH: "1" },
        log: (line) => lines.push(line),
        today: () => "2026-05-16",
      });
      expect(lines).toEqual([]);
    });

    it("no-ops when already warned today", async () => {
      const home = await mkdtemp(join(tmpdir(), "flowctl-mcp-run-"));
      await recordWarnedToday(home, "2026-05-16");
      const lines: string[] = [];
      await runMcpHealthCheck(minimalCtx(home, home, join(home, "events.jsonl")), {
        log: (line) => lines.push(line),
        today: () => "2026-05-16",
      });
      expect(lines).toEqual([]);
    });

    it("prints warnings and records marker when issues exist", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-16T12:00:00.000Z"));
      const root = await mkdtemp(join(tmpdir(), "flowctl-mcp-run-"));
      const home = join(root, "home");
      await mkdir(home, { recursive: true });
      const lines: string[] = [];
      await runMcpHealthCheck(
        minimalCtx(root, home, join(home, "cache", "events.jsonl")),
        { log: (line) => lines.push(line) },
      );
      expect(lines.some((l) => l.includes("MCP Health Check"))).toBe(true);
      expect(lines.some((l) => l.includes("mcp.json"))).toBe(true);
      expect(await hasWarnedToday(home, "2026-05-16")).toBe(true);
    });

    it("does not print when configuration is healthy", async () => {
      const root = await mkdtemp(join(tmpdir(), "flowctl-mcp-run-"));
      const home = join(root, "home");
      const cursorDir = join(root, ".cursor");
      await mkdir(cursorDir, { recursive: true });
      await mkdir(join(home, "cache"), { recursive: true });
      await writeFile(
        join(cursorDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            "shell-proxy": { env: { FLOWCTL_HOME: home } },
          },
        }),
        "utf-8",
      );
      await writeFile(join(home, "cache", "events.jsonl"), '{"t":1}\n', "utf-8");
      const lines: string[] = [];
      await runMcpHealthCheck(
        minimalCtx(root, home, join(home, "cache", "events.jsonl")),
        { log: (line) => lines.push(line), today: () => "2026-05-16" },
      );
      expect(lines).toEqual([]);
    });
  });

  describe("command wiring", () => {
    async function setupCommandCtx(): Promise<FlowctlContext> {
      const tmp = await mkdtemp(join(tmpdir(), "flowctl-mcp-wire-"));
      const repo = join(tmp, "repo");
      await mkdir(join(repo, "workflows", "gates"), { recursive: true });
      const stateFile = join(repo, ".flowctl", "flows", "t1", "state.json");
      await initStateFile(stateFile);
      await setPath(stateFile, "current_step", 1);
      await setPath(stateFile, "steps.1.status", "pending");
      const paths = await refreshRuntimePaths(repo, stateFile, {
        flowctlHome: join(tmp, "home"),
      });
      return {
        projectRoot: repo,
        workflowRoot: repo,
        paths,
        stateFile,
        resolveSource: "env_state_file",
      };
    }

    it("runStart invokes runMcpHealthCheck", async () => {
      const mod = await import("@/utils/mcp-health");
      const spy = vi.spyOn(mod, "runMcpHealthCheck").mockResolvedValue();
      const ctx = await setupCommandCtx();
      await runStart(ctx);
      expect(spy).toHaveBeenCalledWith(ctx);
      spy.mockRestore();
    });

    it("runCursorDispatch invokes runMcpHealthCheck before merge early return", async () => {
      const mod = await import("@/utils/mcp-health");
      const spy = vi.spyOn(mod, "runMcpHealthCheck").mockResolvedValue();
      const ctx = await setupCommandCtx();
      await runCursorDispatch(ctx, { merge: true, skipWarRoom: true });
      expect(spy).toHaveBeenCalledWith(ctx);
      spy.mockRestore();
    });
  });
});
