import type { FlowctlState } from "@/state/schema";
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
