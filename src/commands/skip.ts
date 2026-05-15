import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { invalidateWarRoomDigest } from "@/commands/war-room/digest";
import { readState } from "@/state/reader";
import { FlowctlStateSchema, type Step } from "@/state/schema";
import { setPath } from "@/state/writer";
import { atomicJsonWrite } from "@/utils/json";
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

export type UnskipOptions = {
  step?: string;
  reason?: string;
};

/** Reverse skip for one step — mirrors `cmd_unskip` in scripts/flowctl.sh. */
export async function runUnskip(
  ctx: FlowctlContext,
  opts: UnskipOptions,
): Promise<void> {
  const stepArg = (opts.step ?? "").trim();
  if (!stepArg) {
    throw new Error("Cần chỉ định --step N.");
  }
  const n = Number(stepArg);
  if (!Number.isInteger(n) || n < 1 || n > 9) {
    throw new Error(`Step không hợp lệ: ${stepArg}`);
  }
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const curStatus = getStep(read.data, n)?.status ?? "pending";
  if (curStatus !== "skipped") {
    throw new Error(
      `Step ${stepArg} không ở trạng thái skipped (hiện: ${curStatus}).`,
    );
  }

  const stepName = getStepName(read.data, n);
  const currentStep = Number(read.data.current_step);
  const pullCurrent = n < currentStep;

  await atomicJsonWrite(
    stateFile,
    (current) => {
      const key = String(n);
      const stepObj = current.steps[key];
      if (!stepObj) throw new Error(`Step ${n} không tồn tại trong state.`);
      let nextCurrent = current.current_step;
      if (pullCurrent) {
        nextCurrent = n;
      }
      const unskipped: Step = {
        ...stepObj,
        status: "pending",
        skip_reason: "",
        skip_type: "",
        skipped_by: "",
        skipped_at: "",
      };
      return {
        ...current,
        current_step: nextCurrent,
        steps: {
          ...current.steps,
          [key]: unskipped,
        },
        updated_at: nowTimestamp(),
      };
    },
    FlowctlStateSchema,
  );

  await invalidateWarRoomDigest(ctx.paths.dispatchBase, stepArg);

  if (pullCurrent) {
    console.log(
      chalk.yellow(`current_step đã được đặt lại về step ${stepArg}.`),
    );
  }

  console.log(
    chalk.green(`\n✓ Step ${stepArg} — ${stepName}: UNSKIPPED (pending)`),
  );
  if (opts.reason?.trim()) {
    console.log(`  Lý do unskip: ${opts.reason.trim()}`);
  }
  console.log("");
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
