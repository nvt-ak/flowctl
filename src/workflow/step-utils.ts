import type { FlowctlState, Step } from "@/state/schema";

export function requireCurrentStep(state: FlowctlState): number {
  const step = Number(state.current_step);
  if (!step || step === 0) {
    throw new Error("Workflow chưa được khởi tạo. Chạy: flowctl init");
  }
  return step;
}

export function getStep(state: FlowctlState, step: number): Step | undefined {
  return state.steps[String(step)];
}

export function getStepName(state: FlowctlState, step: number): string {
  return getStep(state, step)?.name ?? `Step ${step}`;
}

export function getStepAgent(state: FlowctlState, step: number): string {
  return getStep(state, step)?.agent ?? "";
}

export function countActiveSteps(state: FlowctlState): number {
  return Object.values(state.steps).filter((s) => s.status !== "skipped").length;
}

export function activeIndexForStep(state: FlowctlState, step: number): number {
  let idx = 0;
  for (let n = 1; n <= 9; n++) {
    const s = getStep(state, n);
    if (s?.status !== "skipped") {
      idx += 1;
    }
    if (n === step) {
      return idx;
    }
  }
  return idx;
}

export function nextNonSkippedStep(
  state: FlowctlState,
  fromStep: number,
): number | null {
  for (let n = fromStep; n <= 9; n++) {
    const status = getStep(state, n)?.status ?? "pending";
    if (status !== "skipped") {
      return n;
    }
  }
  return null;
}

export function advancePastSkipped(
  state: FlowctlState,
  startStep: number,
): { step: number; skipped: Array<{ step: number; name: string; reason: string }> } {
  let step = startStep;
  const skipped: Array<{ step: number; name: string; reason: string }> = [];
  while (step <= 9) {
    const status = getStep(state, step)?.status ?? "pending";
    if (status !== "skipped") {
      break;
    }
    skipped.push({
      step,
      name: getStepName(state, step),
      reason: getStep(state, step)?.skip_reason ?? "",
    });
    step += 1;
  }
  return { step, skipped };
}
