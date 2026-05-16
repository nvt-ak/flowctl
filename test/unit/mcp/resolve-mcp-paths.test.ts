import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProjectMcpCacheDir } from "@/mcp/resolve-mcp-cache-dir";
import {
  resolveMcpDispatchBase,
  resolveMcpStatePath,
} from "@/mcp/resolve-mcp-state-path";

describe("mcp/resolve paths", () => {
  describe("resolveMcpStatePath", () => {
    it("prefers FLOWCTL_STATE_FILE (absolute and relative)", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-state-"));
      const abs = join(repo, "custom", "state.json");
      await mkdir(join(repo, "custom"), { recursive: true });
      await writeFile(abs, "{}", "utf-8");
      expect(resolveMcpStatePath(repo, { FLOWCTL_STATE_FILE: abs })).toBe(abs);
      expect(
        resolveMcpStatePath(repo, { FLOWCTL_STATE_FILE: "custom/state.json" }),
      ).toBe(abs);
    });

    it("uses flows.json active flow state_file", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-flows-"));
      const flowDir = join(repo, ".flowctl");
      await mkdir(flowDir, { recursive: true });
      const statePath = join(repo, "flows", "task-a.json");
      await mkdir(join(repo, "flows"), { recursive: true });
      await writeFile(statePath, "{}", "utf-8");
      await writeFile(
        join(flowDir, "flows.json"),
        JSON.stringify({
          active_flow_id: "task-a",
          flows: { "task-a": { state_file: "flows/task-a.json" } },
        }),
        "utf-8",
      );
      expect(resolveMcpStatePath(repo, {})).toBe(statePath);
    });

    it("falls back to repo/flowctl-state.json", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-legacy-"));
      expect(resolveMcpStatePath(repo, {})).toBe(join(repo, "flowctl-state.json"));
    });
  });

  describe("resolveMcpDispatchBase", () => {
    it("honors DISPATCH_BASE env override", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-dispatch-env-"));
      const custom = join(repo, "my-dispatch");
      expect(
        resolveMcpDispatchBase(repo, join(repo, "flowctl-state.json"), {
          DISPATCH_BASE: custom,
        }),
      ).toBe(custom);
    });

    it("derives dispatch path from wf-* flow_id in state", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-dispatch-fid-"));
      const stateFile = join(repo, "flowctl-state.json");
      await writeFile(
        stateFile,
        JSON.stringify({ flow_id: "wf-20260101-abcdextra" }),
        "utf-8",
      );
      expect(resolveMcpDispatchBase(repo, stateFile, {})).toBe(
        join(repo, "workflows", "20260101", "dispatch"),
      );
    });

    it("defaults to workflows/dispatch when flow_id absent", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-dispatch-def-"));
      expect(resolveMcpDispatchBase(repo, join(repo, "flowctl-state.json"), {})).toBe(
        join(repo, "workflows", "dispatch"),
      );
    });
  });

  describe("resolveProjectMcpCacheDir", () => {
    it("honors FLOWCTL_CACHE_DIR override", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-cache-env-"));
      const custom = join(repo, "override-cache");
      expect(resolveProjectMcpCacheDir(repo, { FLOWCTL_CACHE_DIR: custom })).toBe(
        custom,
      );
    });

    it("reads cache_dir from registry meta.json when path matches repo", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-cache-meta-"));
      const home = join(repo, ".flowctl");
      const projects = join(home, "projects", "proj-hash");
      await mkdir(projects, { recursive: true });
      const metaCache = join(repo, "from-meta");
      await writeFile(
        join(projects, "meta.json"),
        JSON.stringify({ path: repo, cache_dir: metaCache }),
        "utf-8",
      );
      expect(resolveProjectMcpCacheDir(repo, { FLOWCTL_HOME: home })).toBe(metaCache);
    });

    it("falls back to repo/.cache/mcp", async () => {
      const repo = await mkdtemp(join(tmpdir(), "mcp-cache-fb-"));
      expect(resolveProjectMcpCacheDir(repo, {})).toBe(join(repo, ".cache", "mcp"));
    });
  });
});
