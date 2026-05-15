import type { FlowctlState, Step } from "@/state/schema";
import { pathExists } from "@/utils/fs";
import { join, relative } from "node:path";

export type BuildSnapshotOpts = {
  state: FlowctlState;
  step: string;
  repoRoot: string;
  dispatchBase: string;
  generatedAt?: Date;
};

/** Port of context_snapshot.py `build_snapshot`. */
export async function buildContextSnapshot(
  opts: BuildSnapshotOpts,
): Promise<string> {
  const data = opts.state;
  const step = String(opts.step || data.current_step || "1");
  const steps = data.steps ?? {};
  const s: Step | undefined = steps[step];
  const stepName = s?.name ?? "";
  const status = s?.status ?? "";
  const primary = s?.agent ?? "";
  const supports = (s?.support_agents ?? []).filter(
    (a: string) => a && a !== primary,
  );
  const dr = s?.dispatch_risk;
  const digestPath = join(opts.dispatchBase, `step-${step}`, "context-digest.md");
  const digestRel = relative(opts.repoRoot, digestPath);
  const digestNote = (await pathExists(digestPath))
    ? `\`${digestRel}\` (exists — skim War Room / prior context)`
    : `\`${digestRel}\` (not created yet)`;

  const decisions = s?.decisions ?? [];
  const recent = decisions.slice(-8);
  const decLines: string[] = [];
  for (const d of recent) {
    if (typeof d === "object" && d !== null && "description" in d) {
      const desc = String((d as { description?: string }).description ?? "").slice(
        0,
        200,
      );
      const date = String((d as { date?: string }).date ?? "");
      decLines.push(`- (${date}) ${desc}`);
    } else {
      decLines.push(`- ${String(d).slice(0, 200)}`);
    }
  }
  if (decLines.length === 0) {
    decLines.push("- (none recorded on this step)");
  }

  const openBlockers: string[] = [];
  const skippedSteps: string[] = [];
  const stepKeys = Object.keys(steps).sort(
    (a, b) => (Number(a) || 0) - (Number(b) || 0),
  );
  for (const sn of stepKeys) {
    const sobj = steps[sn];
    if (!sobj) continue;
    for (const b of sobj.blockers ?? []) {
      if (typeof b === "object" && b !== null && !b.resolved) {
        const desc = String(b.description ?? "").slice(0, 160);
        openBlockers.push(`- Step ${sn}: ${desc}`);
      }
    }
    if (sobj.status === "skipped") {
      const sname = sobj.name ?? "";
      const sreason = sobj.skip_reason ?? "";
      skippedSteps.push(
        sreason
          ? `- Step ${sn} (${sname}): ${sreason}`
          : `- Step ${sn} (${sname})`,
      );
    }
  }
  if (openBlockers.length === 0) {
    openBlockers.push("- (none)");
  }

  const riskBits: string[] = [];
  if (dr?.high_risk) riskBits.push("high_risk=true");
  if (typeof dr?.impacted_modules === "number") {
    riskBits.push(`impacted_modules=${dr.impacted_modules}`);
  }
  if (typeof dr?.dispatch_count === "number") {
    riskBits.push(`dispatch_count=${dr.dispatch_count}`);
  }
  const riskLine =
    riskBits.length > 0
      ? riskBits.join(", ")
      : "(defaults — no PM risk flags set)";

  const skippedSection =
    skippedSteps.length > 0
      ? `\n### Skipped steps (why they were skipped)\n${skippedSteps.join("\n")}\n`
      : "";

  const at = opts.generatedAt ?? new Date();
  const ageMinutes = (Date.now() - at.getTime()) / 60_000;
  const freshness =
    ageMinutes < 30
      ? "**FRESH** (< 30 min) — prefer this file; skip `wf_step_context()` unless you edited state"
      : `**⚠ STALE** (${Math.floor(ageMinutes)} min ago) — call \`wf_state()\` to verify step/status before work`;

  const supportLine =
    supports.length > 0
      ? supports.map((x: string) => `\`${x}\``).join(", ")
      : "(none)";

  return `## Context Snapshot (Step ${step}: ${stepName})

_Generated: ${formatLocal(at)} — ${freshness}_

| Field | Value |
|-------|-------|
| Project | ${data.project_name ?? ""} |
| Step | ${step} |
| Status | ${status} |
| Primary | \`${primary}\` |
| Support | ${supportLine} |
| dispatch_risk | ${riskLine} |
${skippedSection}
### Recent decisions (this step, last up to 8)
${decLines.join("\n")}

### Open blockers (all steps)
${openBlockers.slice(0, 15).join("\n")}

### Context digest path
${digestNote}

> **When to call \`wf_step_context()\`**: after edits to workflow state (.flowctl/flows/.../state.json or FLOWCTL_STATE_FILE), new blockers/decisions, or if this snapshot is stale. Otherwise prefer this block + code layers below.
`;
}

function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
