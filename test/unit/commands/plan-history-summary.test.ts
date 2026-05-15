import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FlowctlContext } from "@/cli/context";
import {
  buildReleaseDashboardMarkdown,
  formatApprovalHistory,
} from "@/integrations/reporting";
import { runPlan } from "@/commands/plan";
import { runReset } from "@/commands/reset";
import { refreshRuntimePaths } from "@/config/paths";
import { defaultState } from "@/state/default-state";
import { FlowctlStateSchema } from "@/state/schema";
import { initStateFile, writeState } from "@/state/writer";

describe("Phase 3 week 4 — plan, history, release-dashboard, reset", () => {
  const dirs: string[] = [];
  afterEach(() => {
    dirs.length = 0;
  });

  async function tmpRepo(): Promise<{ repo: string; ctx: FlowctlContext }> {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-w4-"));
    dirs.push(tmp);
    const repo = join(tmp, "repo");
    await mkdir(join(repo, "workflows", "dispatch"), { recursive: true });
    const stateFile = join(repo, ".flowctl", "flows", "x1", "state.json");
    await initStateFile(stateFile);
    const state = defaultState();
    state.flow_id = "wf-12345678-abcd-ef00-000000000000";
    state.project_name = "Demo";
    state.current_step = 1;
    state.steps["1"] = {
      ...state.steps["1"],
      name: "Requirements",
      agent: "pm",
      status: "in_progress",
      approval_status: "approved",
      approved_by: "PM",
      approved_at: "2026-01-01",
    };
    await writeState(stateFile, FlowctlStateSchema.parse(state));
    const paths = await refreshRuntimePaths(repo, stateFile);
    const ctx: FlowctlContext = {
      projectRoot: repo,
      workflowRoot: join(repo, ".."),
      paths,
      stateFile,
      resolveSource: "env_state_file",
    };
    return { repo, ctx };
  }

  it("formatApprovalHistory lists approved step", async () => {
    const { ctx } = await tmpRepo();
    const st = await readFile(ctx.stateFile!, "utf-8");
    const data = FlowctlStateSchema.parse(JSON.parse(st));
    const out = formatApprovalHistory(data);
    expect(out).toContain("Approval History");
    expect(out).toContain("APPROVED");
    expect(out).toContain("Requirements");
  });

  it("runPlan writes plan.md under workflows/.../plans", async () => {
    const { ctx, repo } = await tmpRepo();
    await runPlan(ctx);
    const planPath = join(repo, "workflows", "12345678", "plans", "plan.md");
    const text = await readFile(planPath, "utf-8");
    expect(text).toContain("Project Plan");
    expect(text).toContain("Demo");
    expect(text).toContain("Requirements");
  });

  it("buildReleaseDashboardMarkdown includes gate fields", async () => {
    const { ctx } = await tmpRepo();
    const st = await readFile(ctx.stateFile!, "utf-8");
    const data = FlowctlStateSchema.parse(JSON.parse(st));
    const md = await buildReleaseDashboardMarkdown({
      state: data,
      paths: ctx.paths,
      step: 1,
      projectRoot: ctx.projectRoot,
      gateOk: true,
      gateDetail: "ok",
    });
    expect(md).toContain("# Release Dashboard");
    expect(md).toContain("gate_passed: yes");
  });

  it("reset with yes clears step 2 fields when resetting to 1", async () => {
    const { ctx } = await tmpRepo();
    const stateFile = ctx.stateFile!;
    const cur = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    cur.current_step = 2;
    cur.steps["2"] = {
      ...cur.steps["2"],
      name: "Design",
      status: "completed",
      blockers: [{ id: "b1", description: "x", created_at: "t", resolved: false }],
    };
    await writeState(stateFile, FlowctlStateSchema.parse(cur));
    await runReset(ctx, "1", { yes: true });
    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    expect(after.current_step).toBe(1);
    expect(after.steps["2"]?.status).toBe("pending");
    expect(after.steps["2"]?.blockers).toEqual([]);
  });
});
