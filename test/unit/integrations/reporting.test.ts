import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { refreshRuntimePaths } from "@/config/paths";
import {
  buildReleaseDashboardMarkdown,
  formatApprovalHistory,
  formatStepSummary,
} from "@/integrations/reporting";
import { defaultState } from "@/state/default-state";

describe("reporting integrations", () => {
  it("formatStepSummary handles empty deliverables and open blockers", () => {
    const state = defaultState();
    const step = state.steps["1"];
    if (!step) throw new Error("fixture: missing step 1");
    step.deliverables = [];
    step.blockers = [
      { id: "b1", description: "Waiting on API", created_at: "t", resolved: false },
      { id: "b2", description: "Done", created_at: "t", resolved: true },
    ];
    step.decisions = [
      { id: "d1", description: "Use REST", date: "2026-01-01", source: "pm" },
      {
        id: "d2",
        description: "Rejected scope",
        date: "2026-01-02",
        source: "pm",
        type: "rejection",
      },
    ];

    const out = formatStepSummary(state, 1);
    expect(out).toContain("Deliverables (0):");
    expect(out).toContain("Blockers: 2 total, 1 open");
    expect(out).toContain("Waiting on API");
    expect(out).toContain("Use REST");
    expect(out).not.toContain("Rejected scope");
  });

  it("formatStepSummary formats object deliverables and missing step", () => {
    const state = defaultState();
    state.steps["1"]!.deliverables = [
      { claim: "api.md", path: "docs/api.md", verified: true },
      "plain-string-deliverable",
    ];

    const named = formatStepSummary(state, 1);
    expect(named).toContain("api.md");
    expect(named).toContain("plain-string-deliverable");

    const missing = formatStepSummary(state, 99);
    expect(missing).toContain("Step 99 Summary:");
    expect(missing).toContain("Agent:      @");
  });

  it("formatApprovalHistory shows rejected and skips steps without approval", () => {
    const state = defaultState();
    state.steps["1"]!.approval_status = "rejected";
    state.steps["1"]!.approved_by = "Tech Lead";
    state.steps["1"]!.approved_at = "2026-02-01";
    state.steps["2"]!.approval_status = "approved";
    state.steps["2"]!.approved_by = "PM";
    state.steps["2"]!.approved_at = "2026-02-02";
    delete state.steps["3"]!.approval_status;

    const out = formatApprovalHistory(state);
    expect(out).toContain("REJECTED");
    expect(out).toContain("✗");
    expect(out).toContain("APPROVED");
    expect(out).not.toMatch(/Step 3:/);
  });

  it("buildReleaseDashboardMarkdown covers gate fail, manifest, and trace branches", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-rpt-"));
    const state = defaultState();
    state.project_name = "Acme";
    state.flow_id = "wf-12345678-abcd-ef00-000000000000";
    const step = state.steps["2"];
    if (!step) throw new Error("fixture: missing step 2");
    step.name = "System Design";
    step.status = "in_progress";
    step.approval_status = "pending";
    step.deliverables = ["design.md"];
    step.blockers = [];
    step.decisions = [{ id: "d1", description: "ADR-1", date: "2026-01-01", source: "tl" }];

    const paths = await refreshRuntimePaths(root, null);
    await mkdir(paths.evidenceDir, { recursive: true });
    await mkdir(paths.runtimeDir, { recursive: true });
    const manifestPath = join(paths.evidenceDir, "step-2-manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        file_count: 1,
        signature: "sha256:abc",
        manifest_hash: "abc",
        files: [],
      }),
      "utf-8",
    );
    await writeFile(
      paths.traceabilityFile,
      [
        JSON.stringify({
          step: "2",
          event_type: "task",
          run_id: "run-1",
          correlation_id: "corr-1",
        }),
        JSON.stringify({ step: "2", event_type: "approval", run_id: "run-2" }),
        JSON.stringify({ step: "1", event_type: "task", run_id: "other" }),
        "not-json",
      ].join("\n"),
      "utf-8",
    );
    await writeFile(
      paths.budgetStateFile,
      JSON.stringify({
        run: { consumed_tokens_est: 100, consumed_runtime_seconds: 5, consumed_cost_usd: 0.01 },
        breaker: { state: "open" },
      }),
      "utf-8",
    );

    const md = await buildReleaseDashboardMarkdown({
      state,
      paths,
      step: 2,
      projectRoot: root,
      gateOk: false,
      gateDetail: "tests failing",
    });

    expect(md).toContain("gate_passed: no");
    expect(md).toContain("gate_detail: tests failing");
    expect(md).toContain("approval_ready: no");
    expect(md).toContain("evidence_files: 1");
    expect(md).toContain("latest_task_run_id: run-1");
    expect(md).toContain("breaker_state: open");
    expect(md).toContain("consumed_tokens_est: 100");
  });

  it("buildReleaseDashboardMarkdown uses missing manifest when absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-rpt2-"));
    const state = defaultState();
    const paths = await refreshRuntimePaths(root, null);

    const md = await buildReleaseDashboardMarkdown({
      state,
      paths,
      step: 1,
      projectRoot: root,
      gateOk: true,
      gateDetail: "ok",
    });

    expect(md).toContain("evidence_manifest: missing");
    expect(md).toContain("evidence_signature: missing");
    expect(md).not.toContain("latest_task_run_id:");
  });
});
