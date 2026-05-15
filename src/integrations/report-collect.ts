import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { FlowctlState } from "@/state/schema";
import { todayIso } from "@/utils/time";

export type SuggestedSkip = {
  step: number;
  reason: string;
  source: string;
};

export type CollectResult = {
  noReports: boolean;
  reportCount: number;
  newDeliverables: number;
  newDecisions: number;
  newBlockers: number;
  newUnverified: number;
  suggestedSkips: SuggestedSkip[];
};

function stripListMarker(line: string): string {
  return line.trim().replace(/^[-*+]\s+/, "");
}

function hasDeliverable(
  deliverables: FlowctlState["steps"][string]["deliverables"],
  target: string,
): boolean {
  for (const d of deliverables ?? []) {
    if (typeof d === "string") {
      if (d.includes(target)) return true;
    } else if (d && typeof d === "object") {
      const claim = String(d.claim ?? "");
      const path = String(d.path ?? "");
      if (claim.includes(target) || path.includes(target)) return true;
    }
  }
  return false;
}

function hasDecision(
  decisions: FlowctlState["steps"][string]["decisions"],
  source: string,
  description: string,
): boolean {
  return (decisions ?? []).some(
    (d) => d.source === source && d.description === description,
  );
}

function hasBlocker(
  blockers: FlowctlState["steps"][string]["blockers"],
  source: string,
  description: string,
): boolean {
  return (blockers ?? []).some(
    (b) =>
      b.source === source &&
      b.description === description &&
      !b.resolved,
  );
}

function newId(prefix: string): string {
  return `${prefix}${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
}

/** Pure collect from worker *-report.md files (mutates state in place). */
export function collectFromReports(opts: {
  state: FlowctlState;
  step: string;
  repoRoot: string;
  reportsDir: string;
}): CollectResult {
  const { state, step, repoRoot, reportsDir } = opts;
  if (!existsSync(reportsDir)) {
    return {
      noReports: true,
      reportCount: 0,
      newDeliverables: 0,
      newDecisions: 0,
      newBlockers: 0,
      newUnverified: 0,
      suggestedSkips: [],
    };
  }

  const reportFiles = readdirSync(reportsDir)
    .filter((n) => n.endsWith("-report.md"))
    .sort()
    .map((n) => join(reportsDir, n));

  if (reportFiles.length === 0) {
    return {
      noReports: true,
      reportCount: 0,
      newDeliverables: 0,
      newDecisions: 0,
      newBlockers: 0,
      newUnverified: 0,
      suggestedSkips: [],
    };
  }

  const stepObj = state.steps[step];
  if (!stepObj) {
    throw new Error(`Step ${step} missing in state`);
  }
  if (!stepObj.deliverables) stepObj.deliverables = [];
  if (!stepObj.decisions) stepObj.decisions = [];
  if (!stepObj.blockers) stepObj.blockers = [];

  let newDeliverables = 0;
  let newDecisions = 0;
  let newBlockers = 0;
  let newUnverified = 0;
  const suggestedSkips: SuggestedSkip[] = [];
  const seenSkipSteps = new Set<number>();

  for (const rf of reportFiles) {
    const rel = relative(repoRoot, rf);
    if (!hasDeliverable(stepObj.deliverables, rel)) {
      stepObj.deliverables.push(`${rel} — Worker report`);
      newDeliverables += 1;
    }

    const content = readFileSync(rf, "utf-8");
    for (const rawLine of content.split("\n")) {
      const s = stripListMarker(rawLine);
      if (s.startsWith("DECISION:")) {
        const desc = s.slice("DECISION:".length).trim();
        if (desc && !hasDecision(stepObj.decisions, rel, desc)) {
          stepObj.decisions.push({
            id: newId("D"),
            description: desc,
            date: todayIso(),
            source: rel,
          });
          newDecisions += 1;
        }
      } else if (s.startsWith("BLOCKER:")) {
        const desc = s.slice("BLOCKER:".length).trim();
        if (desc && desc.toUpperCase() !== "NONE") {
          if (!hasBlocker(stepObj.blockers, rel, desc)) {
            stepObj.blockers.push({
              id: newId("B"),
              description: desc,
              created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
              resolved: false,
              source: rel,
            });
            newBlockers += 1;
          }
        }
      } else if (s.startsWith("DELIVERABLE:")) {
        const item = s.slice("DELIVERABLE:".length).trim();
        if (item && !hasDeliverable(stepObj.deliverables, item)) {
          const pathPart = item.split(/\s+[—\-]\s+/)[0]?.trim() ?? item;
          const isFileClaim =
            (pathPart.includes("/") || /\.\w{1,6}$/.test(pathPart)) &&
            !pathPart.startsWith("http");
          let verified = true;
          if (isFileClaim) {
            const candidate = join(repoRoot, pathPart);
            if (!existsSync(candidate)) verified = false;
          }
          if (isFileClaim) {
            stepObj.deliverables.push({
              claim: item,
              path: pathPart,
              verified,
              source: rel,
            });
          } else {
            stepObj.deliverables.push(item);
          }
          if (!verified) newUnverified += 1;
          newDeliverables += 1;
        }
      } else if (s.startsWith("SUGGESTED_SKIP:")) {
        const body = s.slice("SUGGESTED_SKIP:".length).trim();
        let stepPart: string;
        let reason: string;
        if (body.includes("|")) {
          [stepPart, reason] = body.split("|", 2) as [string, string];
        } else if (body.includes("—")) {
          [stepPart, reason] = body.split("—", 2) as [string, string];
        } else {
          stepPart = body;
          reason = "";
        }
        const sn = Number.parseInt(stepPart.trim(), 10);
        if (sn >= 1 && sn <= 9 && !seenSkipSteps.has(sn)) {
          seenSkipSteps.add(sn);
          suggestedSkips.push({
            step: sn,
            reason: reason.trim() || "from worker report",
            source: rel,
          });
        }
      }
    }
  }

  state.metrics = state.metrics ?? {
    total_blockers: 0,
    total_decisions: 0,
    steps_completed: 0,
    on_schedule: true,
  };
  state.metrics.total_decisions = Math.max(
    state.metrics.total_decisions ?? 0,
    0,
  );
  state.metrics.total_blockers = Math.max(
    state.metrics.total_blockers ?? 0,
    0,
  );

  return {
    noReports: false,
    reportCount: reportFiles.length,
    newDeliverables,
    newDecisions,
    newBlockers,
    newUnverified,
    suggestedSkips,
  };
}
