import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { setPath } from "@/state/writer";
import { nowTimestamp } from "@/utils/time";
import {
  skipPresetSteps,
  skipReasonLabel,
} from "@/workflow/skip-presets";
import { getStep, getStepName, requireCurrentStep } from "@/workflow/step-utils";

export type SkipOptions = {
  steps?: string;
  preset?: string;
  reasonType?: string;
  reason?: string;
  by?: string;
};

function parseStepsList(stepsArg: string): number[] {
  return stepsArg
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 9);
}

export async function runSkip(ctx: FlowctlContext, opts: SkipOptions): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  requireCurrentStep(read.data);

  let stepsList: number[] = [];
  let reasonType = opts.reasonType ?? "custom";
  let reason = opts.reason ?? "";

  if (opts.preset) {
    stepsList = skipPresetSteps(opts.preset);
    if (stepsList.length === 0) {
      throw new Error(`Preset không hợp lệ: ${opts.preset}`);
    }
    if (!reason) reason = `Preset: ${opts.preset}`;
    if (reasonType === "custom") reasonType = opts.preset;
  } else if (opts.steps) {
    stepsList = parseStepsList(opts.steps);
  } else {
    throw new Error("Cần chỉ định --steps hoặc --preset.");
  }

  const label = skipReasonLabel(reasonType);
  if (!reason) reason = label;
  const by = opts.by ?? "PM";
  const skippedNames: string[] = [];

  for (const s of stepsList) {
    const status = getStep(read.data, s)?.status ?? "pending";
    if (status === "completed") {
      console.log(chalk.yellow(`Step ${s} đã hoàn thành — không thể skip.`));
      continue;
    }
    const current = Number(read.data.current_step);
    if (s === current && status === "in_progress") {
      console.log(
        chalk.yellow(`Step ${s} đang in_progress — không thể skip.`),
      );
      continue;
    }
    const stepName = getStepName(read.data, s);
    await setPath(stateFile, `steps.${s}.status`, "skipped");
    await setPath(stateFile, `steps.${s}.skip_reason`, reason);
    await setPath(stateFile, `steps.${s}.skip_type`, reasonType);
    await setPath(stateFile, `steps.${s}.skipped_by`, by);
    await setPath(stateFile, `steps.${s}.skipped_at`, nowTimestamp());
    skippedNames.push(`Step ${s}: ${stepName}`);
  }

  const after = await readState(stateFile);
  if (!after.ok) throw new Error(after.error);
  const currentStep = Number(after.data.current_step);
  const curStatus = getStep(after.data, currentStep)?.status ?? "pending";
  if (curStatus === "skipped") {
    for (let n = currentStep + 1; n <= 10; n++) {
      const st = getStep(after.data, n)?.status ?? "pending";
      if (st !== "skipped") {
        await setPath(stateFile, "current_step", n);
        break;
      }
    }
  }

  console.log(chalk.yellow.bold("\n⊘ Steps đã được skip:"));
  for (const name of skippedNames) {
    console.log(chalk.yellow(`  ░ ${name}`));
  }
  console.log(`  Lý do: ${reason} (type: ${reasonType})`);
  console.log(`  Skipped by: ${by}\n`);
}
