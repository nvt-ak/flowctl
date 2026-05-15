import type { FlowctlState } from "@/state/schema";

/** Primary + support agents for a step (deduped, order preserved). */
export function collectStepRoles(state: FlowctlState, step: string): string[] {
  const s = state.steps[step];
  if (!s) return [];
  const primary = (s.agent ?? "").trim();
  const supports = (s.support_agents ?? [])
    .map((a) => a.trim())
    .filter((a) => a && a !== primary);
  const roles: string[] = [];
  for (const role of [primary, ...supports]) {
    if (role && !roles.includes(role)) roles.push(role);
  }
  return roles;
}
