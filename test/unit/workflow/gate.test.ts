import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FlowctlPaths } from "@/config/paths";
import { captureStepEvidence } from "@/integrations/evidence";
import { defaultState } from "@/state/default-state";
import { evaluateGate, writeGateReport } from "@/workflow/gate";

async function makeGatePaths(root: string): Promise<FlowctlPaths> {
  const dispatchBase = join(root, "dispatch");
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
        require_mercenary_outputs_completed: false,
      },
    }),
    "utf-8",
  );
  return {
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
}

describe("workflow/evaluateGate", () => {
  it("passes when policy, reports, and deliverables are satisfied", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-"));
    const paths = await makeGatePaths(root);
    const reportsDir = join(paths.dispatchBase, "step-1", "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(join(reportsDir, "worker-report.md"), "# ok\n", "utf-8");

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

  it("auto-passes skipped steps", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-skip-"));
    const paths = await makeGatePaths(root);
    const state = defaultState();
    state.steps["2"] = {
      ...state.steps["2"]!,
      status: "skipped",
      skip_reason: "api-only preset",
    };
    const r = await evaluateGate(state, paths, 2, root);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toContain("auto-pass");
  });

  it("fails when gate policy file is missing", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-nopolicy-"));
    const paths = await makeGatePaths(root);
    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("missing step 1");
    state.steps["1"] = { ...step1, status: "in_progress", deliverables: ["x.md"] };
    const r = await evaluateGate(
      state,
      { ...paths, qaGateFile: join(root, "missing-policy.json") },
      1,
      root,
      { skipEvidence: true },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("Gate policy not found");
  });

  it("fails when evidence manifest checksums do not match", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-ev-"));
    const paths = await makeGatePaths(root);
    const reportsDir = join(paths.dispatchBase, "step-1", "reports");
    await mkdir(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, "dev-report.md");
    await writeFile(reportPath, "stable\n", "utf-8");
    const manifestPath = await captureStepEvidence({
      step: 1,
      repoRoot: root,
      evidenceDir: paths.evidenceDir,
      dispatchBase: paths.dispatchBase,
    });
    await writeFile(reportPath, "tampered\n", "utf-8");

    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("missing step 1");
    state.steps["1"] = {
      ...step1,
      status: "in_progress",
      deliverables: ["dev-report.md"],
    };

    const r = await evaluateGate(state, paths, 1, root);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("Evidence integrity failed");
    expect(manifestPath).toContain("step-1-manifest.json");
  });

  it("fails policy checks for status, approval, reports, deliverables, blockers", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-fail-"));
    const paths = await makeGatePaths(root);
    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("missing step 1");
    state.steps["1"] = {
      ...step1,
      status: "pending",
      approval_status: "approved",
      deliverables: [],
      decisions: [],
      blockers: [
        {
          id: "b1",
          description: "x",
          created_at: "2026-01-01T00:00:00Z",
          resolved: false,
        },
      ],
    };

    const r = await evaluateGate(state, paths, 1, root, { skipEvidence: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail).toContain("Step status must be");
      expect(r.detail).toContain("already approved");
      expect(r.detail).toContain("worker report");
      expect(r.detail).toContain("deliverable");
      expect(r.detail).toContain("Open blockers");
    }
  });

  it("fails when mercenary outputs are required but missing", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-merc-"));
    const paths = await makeGatePaths(root);
    await writeFile(
      paths.qaGateFile,
      JSON.stringify({
        defaults: {
          allowed_step_statuses_for_approve: ["in_progress"],
          min_worker_reports: 0,
          min_deliverables: 0,
          require_mercenary_outputs_completed: true,
        },
      }),
      "utf-8",
    );
    const mercDir = join(paths.dispatchBase, "step-1", "mercenaries");
    await mkdir(mercDir, { recursive: true });
    await writeFile(join(mercDir, "scan-brief.md"), "# brief\n", "utf-8");

    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("missing step 1");
    state.steps["1"] = { ...step1, status: "in_progress", deliverables: ["x.md"] };

    const r = await evaluateGate(state, paths, 1, root, { skipEvidence: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("Mercenary output(s) missing: scan");
  });

  it("counts deliverable objects with report paths in state", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-deliv-obj-"));
    const paths = await makeGatePaths(root);
    await writeFile(
      paths.qaGateFile,
      JSON.stringify({
        defaults: {
          allowed_step_statuses_for_approve: ["in_progress"],
          min_worker_reports: 1,
          min_deliverables: 1,
          min_decisions: 1,
        },
      }),
      "utf-8",
    );
    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("missing step 1");
    state.steps["1"] = {
      ...step1,
      status: "in_progress",
      approval_status: "pending",
      deliverables: [{ claim: "report", path: "team-report.md", verified: true, source: "collect" }],
      decisions: [{ id: "d1", description: "go", date: "2026-01-01" }],
    };

    const r = await evaluateGate(state, paths, 1, root, { skipEvidence: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toContain("decisions=1");
  });

  it("uses state deliverable reports when disk has none", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-state-reports-"));
    const paths = await makeGatePaths(root);
    const state = defaultState();
    const step1 = state.steps["1"];
    if (!step1) throw new Error("missing step 1");
    state.steps["1"] = {
      ...step1,
      status: "in_progress",
      approval_status: "pending",
      deliverables: ["pm-report.md", "notes.txt"],
    };

    const r = await evaluateGate(state, paths, 1, root, { skipEvidence: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toContain("reports=1(state)");
  });
});

describe("workflow/writeGateReport", () => {
  it("appends jsonl and markdown gate reports", async () => {
    const root = await mkdtemp(join(import.meta.dirname, ".gate-report-"));
    const paths = await makeGatePaths(root);

    await writeGateReport(paths, 2, "PASS", "all checks ok", "qa@example.com");

    const jsonl = await readFile(join(paths.gateReportsDir, "gate-events.jsonl"), "utf-8");
    expect(jsonl).toContain('"step":2');
    expect(jsonl).toContain('"status":"PASS"');

    const md = await readFile(join(paths.gateReportsDir, "step-2-gate.md"), "utf-8");
    expect(md).toContain("actor: qa@example.com");
    expect(md).toContain("detail: all checks ok");
  });
});
