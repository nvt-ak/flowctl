import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkflowStateDeps,
  handleWorkflowToolCall,
  toolAddBlocker,
  toolGetState,
} from "@/mcp/workflow-state";

describe("mcp/workflow-state", () => {
  it("flow_get_state returns parsed state file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wf-state-"));
    const statePath = join(dir, "flowctl-state.json");
    await writeFile(
      statePath,
      JSON.stringify({ project_name: "Demo", current_step: 2 }),
      "utf-8",
    );
    const parsed = JSON.parse(await readFile(statePath, "utf-8"));
    const deps = {
      repoRoot: dir,
      stateFile: statePath,
      runWorkflowCommand: vi.fn(),
      readWorkflowState: () => parsed,
    };
    expect(toolGetState(deps)).toMatchObject({ project_name: "Demo", current_step: 2 });
  });

  it("flow_add_blocker rejects empty description via Zod", () => {
    const deps = createWorkflowStateDeps("/tmp", {});
    const out = handleWorkflowToolCall(deps, "flow_add_blocker", { description: "" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("description");
  });

  it("flow_add_blocker invokes flowctl blocker add", () => {
    const run = vi.fn().mockReturnValue("ok");
    const deps = {
      repoRoot: "/repo",
      stateFile: "/repo/flowctl-state.json",
      runWorkflowCommand: run,
      readWorkflowState: () => ({ current_step: 1 }),
    };
    toolAddBlocker(deps, { description: "blocked on API" });
    expect(run).toHaveBeenCalledWith(["blocker", "add", "blocked on API"]);
  });

  it("unknown tool returns error", () => {
    const deps = createWorkflowStateDeps("/tmp", {});
    const out = handleWorkflowToolCall(deps, "flow_unknown", {});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("Unknown tool");
  });
});
