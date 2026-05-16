import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildShellProxyTools,
  createShellProxyContext,
  handleShellToolCall,
  toolCacheInvalidate,
  toolCacheStats,
  toolEnvInfo,
  toolGitContext,
  toolProjectFiles,
  toolReadFile,
  toolSetAgent,
  toolStepContext,
  toolWfReportsStatus,
  toolWfState,
  type ShellProxyContext,
} from "@/mcp/shell-proxy/tools";

async function makeCtx(
  overrides: {
    sh?: (cmd: string) => string;
    state?: Record<string, unknown>;
    layout?: (dir: string) => Promise<void>;
  } = {},
): Promise<{ dir: string; ctx: ShellProxyContext; eventsFile: string; stateFile: string }> {
  const dir = await mkdtemp(join(tmpdir(), "sp-tools-"));
  const cacheDir = join(dir, "cache");
  await mkdir(cacheDir, { recursive: true });
  const stateFile = join(dir, "flowctl-state.json");
  if (overrides.state !== undefined) {
    await writeFile(stateFile, JSON.stringify(overrides.state), "utf-8");
  }
  if (overrides.layout) await overrides.layout(dir);
  const eventsFile = join(cacheDir, "events.jsonl");
  const ctx = createShellProxyContext({
    repo: dir,
    stateFile,
    dispatchBase: join(dir, "workflows", "dispatch"),
    cacheDir,
    eventsFile,
    statsFile: join(cacheDir, "session-stats.json"),
    sh: overrides.sh ?? (() => ""),
  });
  return { dir, ctx, eventsFile, stateFile };
}

describe("mcp/shell-proxy tools", () => {
  describe("toolWfState", () => {
    it("returns summary for valid state file", async () => {
      const { ctx } = await makeCtx({
        state: {
          project_name: "Demo",
          overall_status: "in_progress",
          current_step: 2,
          steps: {
            "2": {
              name: "Design",
              status: "in_progress",
              agent: "tech-lead",
              blockers: [{ resolved: false, description: "API unclear" }],
              decisions: [{ description: "Use REST" }],
              deliverables: [{ path: "docs/adr.md" }],
            },
          },
        },
      });
      const result = toolWfState(ctx);
      expect(result.project).toBe("Demo");
      expect(result.current_step).toBe(2);
      expect(result.open_blockers).toBe(1);
      expect(result._cache).toBe("miss");
    });

    it("returns error when state file is missing", async () => {
      const { ctx } = await makeCtx();
      expect(toolWfState(ctx)).toMatchObject({
        error: "flowctl-state.json not found",
        _cache: "miss",
      });
    });

    it("serves cached result on second call", async () => {
      const { ctx } = await makeCtx({
        state: { project_name: "Cached", current_step: 1, steps: { "1": {} } },
      });
      expect(toolWfState(ctx)._cache).toBe("miss");
      expect(toolWfState(ctx)._cache).toBe("hit");
    });
  });

  describe("toolGitContext", () => {
    it("parses mocked git output and honors commits param", async () => {
      const calls: string[] = [];
      const { ctx } = await makeCtx({
        sh: (cmd) => {
          calls.push(cmd);
          if (cmd.includes("rev-parse")) return "feature/test";
          if (cmd.includes("git log")) return "abc1234|feat: init|2 hours ago";
          if (cmd.includes("git status")) return " M src/a.ts";
          if (cmd.includes("rev-list")) return "2\t1";
          return "";
        },
      });
      const result = toolGitContext(ctx, { commits: 3 });
      expect(result.branch).toBe("feature/test");
      expect(result.recent_commits).toEqual([
        { hash: "abc1234", msg: "feat: init", when: "2 hours ago" },
      ]);
      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(1);
      expect(result.is_clean).toBe(false);
      expect(calls.some((c) => c.includes("-3"))).toBe(true);
    });
  });

  describe("toolStepContext", () => {
    it("returns error when state file is missing", async () => {
      const { ctx } = await makeCtx();
      expect(toolStepContext(ctx, {})).toMatchObject({
        error: "flowctl-state.json not found",
      });
    });

    it("returns not-found shape for unknown step with empty steps map", async () => {
      const { ctx } = await makeCtx({
        state: { current_step: 1, steps: {} },
      });
      const result = toolStepContext(ctx, { step: 99 });
      expect(result.step).toBe(99);
      expect(result.step_name).toBe("");
      expect(result.support_agents).toEqual([]);
    });

    it("includes support_agents, blockers, digest, and war-room flags", async () => {
      const { ctx } = await makeCtx({
        state: {
          current_step: 3,
          steps: {
            "1": {
              decisions: [
                { type: "note", description: "Prior OK" },
                { type: "rejection", description: "ignored" },
              ],
            },
            "2": { status: "skipped", name: "UI", skip_reason: "api-only" },
            "3": {
              name: "Backend",
              agent: "backend",
              support_agents: ["tech-lead"],
              blockers: [{ resolved: false, description: "DB migration" }],
            },
          },
        },
        layout: async (root) => {
          const wr = join(root, "workflows", "dispatch", "step-3", "war-room");
          const merc = join(root, "workflows", "dispatch", "step-3", "mercenaries");
          const digest = join(root, "workflows", "dispatch", "step-3", "context-digest.md");
          await mkdir(wr, { recursive: true });
          await mkdir(merc, { recursive: true });
          await writeFile(join(wr, "pm-analysis.md"), "# PM", "utf-8");
          await writeFile(join(wr, "tech-lead-assessment.md"), "# TL", "utf-8");
          await writeFile(join(merc, "scan-output.md"), "out", "utf-8");
          await writeFile(digest, "## Summary\n- digest line\n", "utf-8");
        },
      });
      const result = toolStepContext(ctx, { step: 3 });
      expect(result.support_agents).toEqual(["tech-lead"]);
      expect(result.open_blockers).toEqual([{ step: 3, text: "DB migration" }]);
      expect(result.prior_decisions).toEqual([{ step: 1, text: "Prior OK" }]);
      expect(result.skipped_steps).toEqual([
        { step: 2, name: "UI", reason: "api-only" },
      ]);
      expect(result.war_room_complete).toBe(true);
      expect(result.mercenary_outputs).toEqual(["scan-output.md"]);
      expect(String(result.context_digest_summary)).toContain("digest line");
    });
  });

  describe("toolProjectFiles", () => {
    it("respects pattern, depth, and ignores node_modules", async () => {
      const { ctx } = await makeCtx({
        layout: async (root) => {
          await mkdir(join(root, "src", "lib"), { recursive: true });
          await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
          await writeFile(join(root, "src", "alpha.ts"), "a", "utf-8");
          await writeFile(join(root, "src", "lib", "beta.ts"), "b", "utf-8");
          await writeFile(join(root, "node_modules", "pkg", "hidden.js"), "x", "utf-8");
          await writeFile(join(root, "readme.md"), "r", "utf-8");
        },
      });
      const shallow = toolProjectFiles(ctx, { dir: ".", pattern: "alpha", depth: 1 });
      const paths = (shallow.entries as { path: string }[]).map((e) => e.path);
      expect(paths).toContain("src/alpha.ts");
      expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
      expect(paths.some((p) => p.includes("lib/beta"))).toBe(false);

      const deep = toolProjectFiles(ctx, { dir: "src", depth: 2 });
      const deepPaths = (deep.entries as { path: string }[]).map((e) => e.path);
      expect(deepPaths.some((p) => p.includes("lib/beta"))).toBe(true);
    });
  });

  describe("toolReadFile", () => {
    it("truncates long text when compress is true", async () => {
      const { ctx } = await makeCtx({
        layout: async (root) => {
          const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
          await writeFile(join(root, "long.txt"), lines.join("\n"), "utf-8");
        },
      });
      const result = toolReadFile(ctx, { path: "long.txt", max_lines: 5, compress: true });
      expect(result.compressed).toBe(true);
      expect(String(result.content)).toContain("more lines truncated");
    });

    it("returns full content when compress is false", async () => {
      const { ctx } = await makeCtx({
        layout: async (root) => {
          const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
          await writeFile(join(root, "plain.txt"), lines.join("\n"), "utf-8");
        },
      });
      const result = toolReadFile(ctx, { path: "plain.txt", max_lines: 5, compress: false });
      expect(result.compressed).toBe(false);
      expect(String(result.content).split("\n")).toHaveLength(20);
    });

    it("compresses large JSON files", async () => {
      const { ctx } = await makeCtx({
        layout: async (root) => {
          const lines = ['{'];
          for (let i = 0; i < 55; i++) lines.push(`  "k${i}": ${i},`);
          lines.push('  "k55": 55');
          lines.push("}");
          await writeFile(join(root, "big.json"), lines.join("\n"), "utf-8");
        },
      });
      const result = toolReadFile(ctx, { path: "big.json", compress: true });
      expect(result.compressed).toBe(true);
      expect(String(result.content)).toMatch(/k0:\s*0/);
    });

    it("reads binary-ish files as utf-8 without throwing", async () => {
      const { ctx } = await makeCtx({
        layout: async (root) => {
          await writeFile(join(root, "data.bin"), Buffer.from([0x00, 0xff, 0x41, 0x42]));
        },
      });
      const result = toolReadFile(ctx, { path: "data.bin", compress: false });
      expect(result.error).toBeUndefined();
      expect(result.lines).toBeGreaterThan(0);
    });
  });

  describe("toolEnvInfo", () => {
    it("returns version fields from sh()", async () => {
      const { ctx } = await makeCtx({
        sh: (cmd) => {
          if (cmd.startsWith("node")) return "v20.0.0";
          if (cmd.startsWith("npm")) return "10.0.0";
          if (cmd.startsWith("python3")) return "Python 3.12.0";
          if (cmd.startsWith("git")) return "git version 2.43.0";
          if (cmd === "uname -s") return "Darwin";
          if (cmd === "uname -m") return "arm64";
          return "";
        },
      });
      const result = toolEnvInfo(ctx);
      expect(result).toMatchObject({
        node: "v20.0.0",
        npm: "10.0.0",
        python: "Python 3.12.0",
        os: "Darwin",
        arch: "arm64",
      });
      expect(result.cwd).toBe(ctx.repo);
    });
  });

  describe("toolWfReportsStatus", () => {
    it("lists submitted and missing roles", async () => {
      const { ctx } = await makeCtx({
        state: {
          current_step: 4,
          steps: {
            "4": { agent: "backend", support_agents: ["qa"] },
          },
        },
        layout: async (root) => {
          const reports = join(root, "workflows", "dispatch", "step-4", "reports");
          await mkdir(reports, { recursive: true });
          await writeFile(
            join(reports, "backend-report.md"),
            "## Summary\nok\n",
            "utf-8",
          );
          await writeFile(
            join(reports, "qa-report.md"),
            "## NEEDS_SPECIALIST\nescalate\n",
            "utf-8",
          );
        },
      });
      const result = toolWfReportsStatus(ctx, {});
      expect(result.expected_roles).toEqual(["backend", "qa"]);
      expect(result.submitted).toEqual(expect.arrayContaining(["backend", "qa"]));
      expect(result.missing).toEqual([]);
      expect(result.needs_specialist).toEqual(["qa"]);
      expect(result.all_done).toBe(true);
    });

    it("reports all expected roles missing when reports dir absent", async () => {
      const { ctx } = await makeCtx({
        state: {
          current_step: 1,
          steps: { "1": { agent: "pm", support_agents: [] } },
        },
      });
      const result = toolWfReportsStatus(ctx, {});
      expect(result.missing).toEqual(["pm"]);
      expect(result.all_done).toBe(false);
    });
  });

  describe("toolSetAgent", () => {
    it("stores agent id on context", async () => {
      const { ctx } = await makeCtx();
      expect(toolSetAgent(ctx, { agent_id: "pm-agent" })).toEqual({ agent_set: "pm-agent" });
    });

    it("rejects missing agent_id via handleShellToolCall", async () => {
      const { ctx } = await makeCtx();
      const tools = buildShellProxyTools(ctx);
      const out = handleShellToolCall(ctx, tools, "wf_set_agent", {});
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.error.length).toBeGreaterThan(0);
    });
  });

  describe("toolCacheInvalidate", () => {
    it("invalidates git scope without clearing state cache", async () => {
      const { ctx } = await makeCtx({
        state: { project_name: "X", current_step: 1, steps: { "1": {} } },
        sh: () => "main",
      });
      toolGitContext(ctx, {});
      toolWfState(ctx);
      const gen = toolCacheInvalidate(ctx, { scope: "git" });
      expect(gen.new_generations).toBeDefined();
      expect(toolGitContext(ctx, {})._cache).toBe("miss");
      expect(toolWfState(ctx)._cache).toBe("hit");
    });

    it("invalidates all scopes", async () => {
      const { ctx } = await makeCtx({
        state: { project_name: "X", current_step: 1, steps: { "1": {} } },
      });
      toolWfState(ctx);
      toolCacheInvalidate(ctx, { scope: "all" });
      expect(toolWfState(ctx)._cache).toBe("miss");
    });
  });

  describe("toolCacheStats", () => {
    it("returns zeros for cold session stats", async () => {
      const { ctx } = await makeCtx();
      const stats = toolCacheStats(ctx);
      expect(stats.total_consumed_tokens).toBe(0);
      expect(stats.tools).toEqual([]);
    });

    it("returns per-tool stats from warmed session-stats.json", async () => {
      const { ctx } = await makeCtx();
      const statsPath = join(ctx.repo, "cache", "session-stats.json");
      await writeFile(
        statsPath,
        JSON.stringify({
          session_start: "2026-01-01T00:00:00.000Z",
          total_consumed_tokens: 1200,
          total_saved_tokens: 800,
          total_cost_usd: 0.05,
          total_saved_usd: 0.02,
          bash_waste_tokens: 0,
          tools: {
            wf_state: { calls: 4, hits: 3, saved: 500 },
          },
        }),
        "utf-8",
      );
      const stats = toolCacheStats(ctx);
      expect(stats.total_consumed_tokens).toBe(1200);
      expect(stats.efficiency_pct).toBeGreaterThan(0);
      const wf = (stats.tools as { name: string; hit_rate: string }[]).find(
        (t) => t.name === "wf_state",
      );
      expect(wf?.hit_rate).toBe("75%");
    });
  });

  describe("withLogging", () => {
    it("appends mcp events when wrapped tools run", async () => {
      const { ctx, eventsFile } = await makeCtx({
        state: { project_name: "Log", current_step: 1, steps: { "1": {} } },
      });
      ctx.setConnectionAgent("test-agent");
      const tools = buildShellProxyTools(ctx);
      tools.find((t) => t.name === "wf_state")!.fn({});
      const lines = (await readFile(eventsFile, "utf-8")).trim().split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const row = JSON.parse(lines[lines.length - 1]!) as {
        type: string;
        tool: string;
        agent: string;
        cache: string;
      };
      expect(row.type).toBe("mcp");
      expect(row.tool).toBe("wf_state");
      expect(row.agent).toBe("test-agent");
      expect(["hit", "miss"]).toContain(row.cache);
    });
  });
});
