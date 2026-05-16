import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FlowctlPaths } from "@/config/paths";
import { defaultState } from "@/state/default-state";
import { evaluateGate } from "@/workflow/gate";

describe("workflow/evaluateGate", () => {
  it("passes when policy, reports, and deliverables are satisfied", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-"));
    const dispatchBase = join(root, "dispatch");
    const reportsDir = join(dispatchBase, "step-1", "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(join(reportsDir, "worker-report.md"), "# ok\n", "utf-8");

    const qaGateFile = join(root, "qa-gate.v1.json");
    await writeFile(
      qaGateFile,
      JSON.stringify({
        version: "1.0.0",
        defaults: {
          allowed_step_statuses_for_approve: ["in_progress"],
          min_worker_reports: 1,
          min_deliverables: 1,
          min_decisions: 0,
          require_no_open_blockers: true,
          deny_if_already_approved: true,
        },
      }),
      "utf-8",
    );

    const paths: FlowctlPaths = {
      flowctlHome: join(root, ".flowctl"),
      dataDir: join(root, "data"),
      cacheDir: join(root, "cache"),
      runtimeDir: join(root, "runtime"),
      stateFile: null,
      idempotencyFile: join(root, "idem.json"),
      roleSessionsFile: join(root, "roles.json"),
      heartbeatsFile: join(root, "hb.jsonl"),
      budgetStateFile: join(root, "budget.json"),
      budgetEventsFile: join(root, "budget-events.jsonl"),
      eventsFile: join(root, "events.jsonl"),
      statsFile: join(root, "stats.json"),
      traceabilityFile: join(root, "trace.jsonl"),
      evidenceDir: join(root, "evidence"),
      releaseDashboardDir: join(root, "release"),
      dispatchBase,
      gateReportsDir: join(root, "gate-reports"),
      retroDir: join(root, "retro"),
      workflowLockDir: join(root, "lock"),
      rolePolicyFile: join(root, "role.json"),
      budgetPolicyFile: join(root, "budget-policy.json"),
      qaGateFile,
      registryFile: join(root, "registry.json"),
    };

    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("default state missing step 1");
    state.steps["1"] = {
      ...step1,
      status: "in_progress",
      approval_status: "pending",
      deliverables: ["x-report.md"],
      decisions: [],
      blockers: [],
    };

    const r = await evaluateGate(state, paths, 1, root, { skipEvidence: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toContain("reports=1");
  });

  it("fails when step is missing", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-"));
    const paths = {
      dispatchBase: join(root, "d"),
      qaGateFile: join(root, "q.json"),
      evidenceDir: join(root, "e"),
    } as FlowctlPaths;
    const state = defaultState();
    const r = await evaluateGate(state, paths, 99, root, { skipEvidence: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("not found");
  });
});
