import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlowctlState, Step } from "@/state/schema";
import type { FlowctlPaths } from "@/config/paths";
import { verifyStepEvidence } from "@/integrations/evidence";
import { pathExists } from "@/utils/fs";
import { nowTimestamp, utcIsoTimestamp } from "@/utils/time";
import { getStep } from "@/workflow/step-utils";

type GatePolicy = {
  defaults?: {
    allowed_step_statuses_for_approve?: string[];
    min_worker_reports?: number;
    min_deliverables?: number;
    min_decisions?: number;
    require_no_open_blockers?: boolean;
    deny_if_already_approved?: boolean;
    require_mercenary_outputs_completed?: boolean;
  };
};

export type GateResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string };

function deliverableReportCount(
  deliverables: Step["deliverables"] | undefined,
): number {
  if (!deliverables) return 0;
  return deliverables.filter((d) => {
    if (typeof d === "string") return d.includes("-report.md");
    return (d.path ?? "").includes("-report.md");
  }).length;
}

async function countDiskReports(dispatchBase: string, step: number): Promise<number> {
  const reportsDir = join(dispatchBase, `step-${step}`, "reports");
  if (!(await pathExists(reportsDir))) return 0;
  const names = await readdir(reportsDir);
  return names.filter((n) => n.endsWith("-report.md")).length;
}

async function countMercenaryMissing(
  dispatchBase: string,
  step: number,
): Promise<string[]> {
  const mercDir = join(dispatchBase, `step-${step}`, "mercenaries");
  if (!(await pathExists(mercDir))) return [];
  const names = await readdir(mercDir);
  const spawned = new Set(
    names.filter((n) => n.endsWith("-brief.md")).map((n) => n.replace(/-brief\.md$/, "")),
  );
  const completed = new Set(
    names.filter((n) => n.endsWith("-output.md")).map((n) => n.replace(/-output\.md$/, "")),
  );
  return [...spawned].filter((s) => !completed.has(s)).sort();
}

/** Port of wf_evaluate_gate (policy + optional evidence verify). */
export async function evaluateGate(
  state: FlowctlState,
  paths: FlowctlPaths,
  step: number,
  projectRoot: string,
  opts: { skipEvidence?: boolean } = {},
): Promise<GateResult> {
  const stepObj = getStep(state, step);
  if (!stepObj) {
    return { ok: false, detail: `Step ${step} not found in flowctl state` };
  }

  if (stepObj.status === "skipped") {
    return {
      ok: true,
      detail: `Step ${step} skipped (${stepObj.skip_reason ?? ""}) — gate auto-pass`,
    };
  }

  if (!opts.skipEvidence) {
    const manifestPath = join(paths.evidenceDir, `step-${step}-manifest.json`);
    if (await pathExists(manifestPath)) {
      const evidence = await verifyStepEvidence({
        step,
        repoRoot: projectRoot,
        manifestPath,
        dispatchBase: paths.dispatchBase,
      });
      if (!evidence.ok) {
        return {
          ok: false,
          detail: `Evidence integrity failed: ${evidence.errors.join("; ")}`,
        };
      }
    }
  }

  if (!(await pathExists(paths.qaGateFile))) {
    return { ok: false, detail: `Gate policy not found: ${paths.qaGateFile}` };
  }

  const gate = JSON.parse(await readFile(paths.qaGateFile, "utf-8")) as GatePolicy;
  const g = gate.defaults ?? {};
  const allowedStatuses = g.allowed_step_statuses_for_approve ?? ["in_progress"];
  const minReports = g.min_worker_reports ?? 1;
  const minDeliverables = g.min_deliverables ?? 1;
  const minDecisions = g.min_decisions ?? 0;
  const requireNoOpenBlockers = g.require_no_open_blockers ?? true;
  const denyIfApproved = g.deny_if_already_approved ?? true;
  const requireMerc = g.require_mercenary_outputs_completed ?? false;

  const errors: string[] = [];
  const status = stepObj.status ?? "";
  const approval = stepObj.approval_status ?? "";
  const deliverables = stepObj.deliverables ?? [];
  const decisions = stepObj.decisions ?? [];
  const openBlockers = (stepObj.blockers ?? []).filter((b) => !b.resolved);

  const diskReports = await countDiskReports(paths.dispatchBase, step);
  const stateReports = deliverableReportCount(deliverables);
  const reportCount = diskReports > 0 ? diskReports : stateReports;
  const reportSource = diskReports > 0 ? "disk" : "state";

  if (!allowedStatuses.includes(status)) {
    errors.push(
      `Step status must be one of ${allowedStatuses.join(", ")}, current=${status || "empty"}`,
    );
  }
  if (denyIfApproved && approval === "approved") {
    errors.push("Step already approved; refusing duplicate approve");
  }
  if (reportCount < minReports) {
    errors.push(`Need >= ${minReports} worker report(s), found ${reportCount}`);
  }
  if (deliverables.length < minDeliverables) {
    errors.push(
      `Need >= ${minDeliverables} deliverable(s), found ${deliverables.length}`,
    );
  }
  if (decisions.length < minDecisions) {
    errors.push(`Need >= ${minDecisions} decision(s), found ${decisions.length}`);
  }
  if (requireNoOpenBlockers && openBlockers.length > 0) {
    errors.push(`Open blockers must be 0, found ${openBlockers.length}`);
  }

  const missingMerc = await countMercenaryMissing(paths.dispatchBase, step);
  if (requireMerc && missingMerc.length > 0) {
    errors.push(`Mercenary output(s) missing: ${missingMerc.join(", ")}`);
  }

  if (errors.length > 0) {
    return { ok: false, detail: errors.join(" ; ") };
  }

  const mercNote =
    missingMerc.length > 0 ? ` merc=${missingMerc.length}_missing` : "";
  return {
    ok: true,
    detail: `step=${step} reports=${reportCount}(${reportSource}) deliverables=${deliverables.length} decisions=${decisions.length} open_blockers=${openBlockers.length}${mercNote}`,
  };
}

export async function writeGateReport(
  paths: FlowctlPaths,
  step: number,
  status: string,
  detail: string,
  actor: string,
): Promise<void> {
  await mkdir(paths.gateReportsDir, { recursive: true });
  const tsHuman = nowTimestamp();
  const tsIso = utcIsoTimestamp();
  const jsonlFile = join(paths.gateReportsDir, "gate-events.jsonl");
  const mdFile = join(paths.gateReportsDir, `step-${step}-gate.md`);

  const event = {
    timestamp: tsIso,
    timestamp_local: tsHuman,
    step,
    status,
    actor,
    detail,
  };
  await appendFile(jsonlFile, `${JSON.stringify(event)}\n`, "utf-8");
  await appendFile(
    mdFile,
    `## [${tsHuman}] ${status}\n- actor: ${actor}\n- detail: ${detail}\n\n`,
    "utf-8",
  );
}
