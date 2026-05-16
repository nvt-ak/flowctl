import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCursorMcp } from "@/integrations/mcp-merge";
import {
  buildShellProxyTools,
  createShellProxyContext,
  toolWfState,
} from "@/mcp/shell-proxy/tools";

describe("integration / MCP Phase 4", () => {
  it("mergeCursorMcp scaffold parity (shell-proxy + flowctl-state)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-int-"));
    const mcpPath = join(dir, "mcp.json");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "flowctl" },
      mergeGlobal: false,
    });
    expect(out.exitCode).toBe(0);
    expect(out.lines.some((l) => l === "MCP_STATUS=created")).toBe(true);
    const raw = JSON.parse(await readFile(mcpPath, "utf-8")) as {
      mcpServers: Record<string, { command?: string; args?: string[] }>;
    };
    expect(raw.mcpServers["shell-proxy"]?.args).toEqual(["mcp", "--shell-proxy"]);
    expect(raw.mcpServers["flowctl-state"]?.args).toEqual(["mcp", "--workflow-state"]);
  });

  it("shell-proxy wf_state reads workflow state from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-sp-"));
    const cacheDir = join(dir, "cache");
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        project_name: "Integration",
        overall_status: "in_progress",
        current_step: 1,
        steps: { "1": { name: "Requirements", status: "in_progress", blockers: [] } },
      }),
      "utf-8",
    );
    const ctx = createShellProxyContext({
      repo: dir,
      stateFile,
      dispatchBase: join(dir, "workflows", "dispatch"),
      cacheDir,
      eventsFile: join(cacheDir, "events.jsonl"),
      statsFile: join(cacheDir, "session-stats.json"),
      sh: () => "",
    });
    const result = toolWfState(ctx);
    expect(result.project).toBe("Integration");
    expect(result.current_step).toBe(1);
    expect(buildShellProxyTools(ctx).map((t) => t.name)).toContain("wf_git");
  });
});
