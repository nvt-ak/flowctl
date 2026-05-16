import { mkdir } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runApprove } from "@/commands/approve";
import { runBlockerAdd } from "@/commands/blocker";
import { runReject } from "@/commands/reject";
import { runSkip } from "@/commands/skip";
import { runStart } from "@/commands/start";
import { readState } from "@/state/reader";
import { initStateFile, setPath } from "@/state/writer";
import { refreshRuntimePaths } from "@/config/paths";
import type { FlowctlContext } from "@/cli/context";

async function makeCtx(repo: string, stateFile: string): Promise<FlowctlContext> {
  const paths = await refreshRuntimePaths(repo, stateFile);
  return {
    projectRoot: repo,
    workflowRoot: join(repo, ".."),
    paths,
    stateFile,
    resolveSource: "env_state_file",
  };
}

describe("Phase 3 workflow commands", () => {
  const dirs: string[] = [];

  afterEach(() => {
    dirs.length = 0;
  });

  async function setupWorkflow(): Promise<FlowctlContext> {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-cmd-"));
    dirs.push(tmp);
    const repo = join(tmp, "repo");
    await mkdir(join(repo, "workflows", "gates"), { recursive: true });
    await mkdir(join(repo, "workflows", "dispatch", "step-1", "reports"), {
      recursive: true,
    });
    const stateFile = join(repo, ".flowctl", "flows", "t1", "state.json");
    await initStateFile(stateFile);
    await setPath(stateFile, "current_step", 1);
    await setPath(stateFile, "steps.1.status", "pending");
    await setPath(stateFile, "steps.1.deliverables", ["workflows/dispatch/step-1/reports/pm-report.md"]);
    return makeCtx(repo, stateFile);
  }

  it("start sets current step to in_progress", async () => {
    const ctx = await setupWorkflow();
    await runStart(ctx);
    const state = await readState(ctx.stateFile!);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.data.steps["1"]?.status).toBe("in_progress");
    }
  });

  it("approve advances current_step with skip-gate", async () => {
    const ctx = await setupWorkflow();
    await runStart(ctx);
    await runApprove(ctx, { by: "Tester", skipGate: true });
    const state = await readState(ctx.stateFile!);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.data.steps["1"]?.approval_status).toBe("approved");
      expect(state.data.steps["1"]?.approved_by).toBe("Tester");
      expect(Number(state.data.current_step)).toBe(2);
    }
  });

  it("approve without skip-gate blocks when QA gate fails", async () => {
    const ctx = await setupWorkflow();
    await runStart(ctx);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runApprove(ctx, { by: "Gate Reviewer" });

    expect(process.exitCode).toBe(1);
    const state = await readState(ctx.stateFile!);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.data.steps["1"]?.approval_status).not.toBe("approved");
    }
    err.mockRestore();
    log.mockRestore();
    process.exitCode = undefined;
  });

  it("reject records rejection decision", async () => {
    const ctx = await setupWorkflow();
    await runStart(ctx);
    await runReject(ctx, "needs more tests");
    const state = await readState(ctx.stateFile!);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.data.steps["1"]?.approval_status).toBe("rejected");
      const decisions = state.data.steps["1"]?.decisions ?? [];
      expect(decisions.some((d) => typeof d === "object" && d.type === "rejection")).toBe(
        true,
      );
    }
  });

  it("skip marks step as skipped", async () => {
    const ctx = await setupWorkflow();
    await runSkip(ctx, { steps: "3", reason: "API only", reasonType: "api-only" });
    const state = await readState(ctx.stateFile!);
    expect(state.ok).toBe(true);
    if (state.ok) {
      expect(state.data.steps["3"]?.status).toBe("skipped");
    }
  });

  it("blocker add appends open blocker", async () => {
    const ctx = await setupWorkflow();
    await runBlockerAdd(ctx, "waiting on API contract");
    const state = await readState(ctx.stateFile!);
    expect(state.ok).toBe(true);
    if (state.ok) {
      const blockers = state.data.steps["1"]?.blockers ?? [];
      expect(blockers.some((b) => !b.resolved)).toBe(true);
    }
  });
});
