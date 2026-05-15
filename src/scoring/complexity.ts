import type { FlowctlState } from "@/state/schema";

export type ComplexityTier = "MICRO" | "STANDARD" | "FULL";

/** Port of wf_complexity_score in complexity.sh */
export function complexityScore(state: FlowctlState, step: string): number {
  const s = state.steps[step];
  if (!s) return 1;

  let score = 1;
  const primary = s.agent ?? "";
  const supports = (s.support_agents ?? []).filter((a) => a && a !== primary);
  const nRoles = 1 + supports.length;
  if (nRoles >= 3) score += 1;

  const dr = s.dispatch_risk;
  if (dr?.high_risk === true) score += 2;
  const im = dr?.impacted_modules;
  if (typeof im === "number" && im > 2) score += 2;

  let openBlockers = 0;
  for (const [sn, sobj] of Object.entries(state.steps)) {
    if (Number(sn) < Number(step)) {
      for (const b of sobj.blockers ?? []) {
        if (!b.resolved) openBlockers += 1;
      }
    }
  }
  if (openBlockers > 0) score += 1;

  if (Number(dr?.dispatch_count ?? 0) === 0) score += 1;

  return Math.max(1, Math.min(5, score));
}

export function complexityTier(score: number): ComplexityTier {
  if (score <= 1) return "MICRO";
  if (score <= 3) return "STANDARD";
  return "FULL";
}

export function warRoomThreshold(
  state: FlowctlState,
  envThreshold?: string,
): number {
  const fromState = state.settings?.war_room_threshold;
  if (fromState !== null && fromState !== undefined && String(fromState).trim() !== "") {
    return Number(fromState);
  }
  const env = (envThreshold ?? process.env.WF_WAR_ROOM_THRESHOLD ?? "").trim();
  if (/^\d+$/.test(env)) return Number(env);
  return 4;
}
