import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FlowctlPaths } from "@/config/paths";
import type { FlowctlState } from "@/state/schema";
import { pathExists } from "@/utils/fs";
import { getStep } from "@/workflow/step-utils";

/** Port of cmd_summary output (without ANSI). */
export function formatStepSummary(state: FlowctlState, step: number): string {
  const s = getStep(state, step);
  const lines: string[] = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `  Step ${step} Summary: ${s?.name ?? ""}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `Agent:      @${s?.agent ?? ""}`,
    `Status:     ${s?.status ?? "pending"}`,
    `Started:    ${s?.started_at ?? "—"}`,
    `Completed:  ${s?.completed_at ?? "—"}`,
    `Approval:   ${s?.approval_status ?? "pending"}`,
    "",
    `Deliverables (${s?.deliverables?.length ?? 0}):`,
  ];
  for (const d of s?.deliverables ?? []) {
    const label = typeof d === "string" ? d : d.claim ?? d.path ?? "";
    lines.push(`  ✓ ${label}`);
  }
  const blockers = s?.blockers ?? [];
  const open = blockers.filter((b) => !b.resolved);
  lines.push("", `Blockers: ${blockers.length} total, ${open.length} open`);
  for (const b of open) {
    lines.push(`  ! ${b.description}`);
  }
  const decisions = (s?.decisions ?? []).filter((d) => d.type !== "rejection");
  lines.push("", `Decisions (${decisions.length}):`);
  for (const d of decisions) {
    lines.push(`  → ${d.description}`);
  }
  lines.push("");
  return lines.join("\n");
}

/** Port of cmd_history (no ANSI). */
export function formatApprovalHistory(state: FlowctlState): string {
  const lines: string[] = [
    `Approval History — ${state.project_name || "Project"}`,
    "",
  ];
  for (let n = 1; n <= 9; n++) {
    const s = state.steps[String(n)];
    if (!s) continue;
    const status = s.approval_status;
    if (!status) continue;
    const icon = status === "approved" ? "✓" : status === "rejected" ? "✗" : "~";
    lines.push(
      `  ${icon} Step ${n}: ${s.name ?? ""} — ${status.toUpperCase()} by ${s.approved_by ?? "?"} @ ${s.approved_at ?? "?"}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

type TraceRow = {
  step?: unknown;
  event_type?: string;
  run_id?: string;
  correlation_id?: string;
};

function parseTraceLines(content: string): TraceRow[] {
  const rows: TraceRow[] = [];
  for (const line of content.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      rows.push(JSON.parse(s) as TraceRow);
    } catch {
      /* skip */
    }
  }
  return rows;
}

/** Port of release-dashboard Python block (markdown body only). */
export async function buildReleaseDashboardMarkdown(input: {
  state: FlowctlState;
  paths: FlowctlPaths;
  step: number;
  projectRoot: string;
  gateOk: boolean;
  gateDetail: string;
}): Promise<string> {
  const { state, paths, step, projectRoot, gateOk, gateDetail } = input;
  const stepKey = String(step);
  const stepObj = state.steps[stepKey] ?? {};
  const manifestPath = join(paths.evidenceDir, `step-${step}-manifest.json`);
  let manifest: { file_count?: number; signature?: string } = {};
  if (await pathExists(manifestPath)) {
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as typeof manifest;
    } catch {
      manifest = {};
    }
  }

  let traceRows: TraceRow[] = [];
  if (await pathExists(paths.traceabilityFile)) {
    const raw = await readFile(paths.traceabilityFile, "utf-8");
    traceRows = parseTraceLines(raw).filter(
      (r) => String(r.step ?? "") === stepKey,
    );
  }

  const taskRows = traceRows.filter((r) => r.event_type === "task");
  const approvalRows = traceRows.filter((r) => r.event_type === "approval");

  let budget: { run?: Record<string, unknown>; breaker?: Record<string, unknown> } =
    {};
  if (await pathExists(paths.budgetStateFile)) {
    try {
      budget = JSON.parse(await readFile(paths.budgetStateFile, "utf-8")) as typeof budget;
    } catch {
      budget = {};
    }
  }
  const runBudget = (budget.run ?? {}) as Record<string, unknown>;
  const breaker = (budget.breaker ?? {}) as Record<string, unknown>;

  const deliverables = (stepObj.deliverables ?? []) as unknown[];
  const blockers = (stepObj.blockers ?? []) as Array<{ resolved?: boolean }>;
  const openBlockers = blockers.filter((b) => !b.resolved);
  const decisions = (stepObj.decisions ?? []) as unknown[];
  const approvalStatus = stepObj.approval_status ?? "pending";

  const ready =
    gateOk &&
    openBlockers.length === 0 &&
    (manifest.file_count ?? 0) > 0 &&
    taskRows.length > 0;

  let manifestDisplay: string;
  if (await pathExists(manifestPath)) {
    try {
      manifestDisplay = relative(projectRoot, manifestPath);
    } catch {
      manifestDisplay = String(manifestPath);
    }
  } else {
    manifestDisplay = "missing";
  }

  const lines: string[] = [
    "# Release Dashboard (PM Approval)",
    "",
    `- project: ${state.project_name ?? ""}`,
    `- flow_id: ${state.flow_id ?? ""}`,
    `- step: ${step} — ${(stepObj as { name?: string }).name ?? ""}`,
    `- step_status: ${(stepObj as { status?: string }).status ?? "pending"}`,
    `- approval_status: ${approvalStatus}`,
    `- approval_ready: ${ready ? "yes" : "no"}`,
    "",
    "## Quality Gates",
    `- gate_passed: ${gateOk ? "yes" : "no"}`,
    `- gate_detail: ${gateDetail}`,
    `- blockers_open: ${openBlockers.length}`,
    "",
    "## Evidence Integrity",
    `- evidence_manifest: ${manifestDisplay}`,
    `- evidence_files: ${manifest.file_count ?? 0}`,
    `- evidence_signature: ${manifest.signature ?? "missing"}`,
    "",
    "## Traceability",
    `- task_trace_events: ${taskRows.length}`,
    `- approval_trace_events: ${approvalRows.length}`,
  ];
  if (taskRows.length > 0) {
    lines.push(`- latest_task_run_id: ${taskRows[taskRows.length - 1]?.run_id ?? ""}`);
    lines.push(
      `- latest_task_correlation_id: ${taskRows[taskRows.length - 1]?.correlation_id ?? ""}`,
    );
  }
  lines.push(
    "",
    "## Delivery Summary",
    `- deliverables: ${deliverables.length}`,
    `- decisions: ${decisions.length}`,
    "",
    "## Budget Snapshot",
    `- breaker_state: ${breaker.state ?? "closed"}`,
    `- consumed_tokens_est: ${runBudget.consumed_tokens_est ?? 0}`,
    `- consumed_runtime_seconds: ${runBudget.consumed_runtime_seconds ?? 0}`,
    `- consumed_cost_usd: ${runBudget.consumed_cost_usd ?? 0}`,
  );
  return lines.join("\n");
}
