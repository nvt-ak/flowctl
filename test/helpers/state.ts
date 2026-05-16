import { defaultState } from "@/state/default-state";
import type { FlowctlState } from "@/state/schema";

/** Valid `FlowctlState` with optional shallow overrides (steps merged per key). */
export function makeState(overrides: Partial<FlowctlState> = {}): FlowctlState {
  const base = defaultState();
  const { steps: stepOverrides, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    steps: stepOverrides ? { ...base.steps, ...stepOverrides } : base.steps,
  };
}
