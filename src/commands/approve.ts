import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { setPath } from "@/state/writer";
import { nowTimestamp } from "@/utils/time";
import { evaluateGate, writeGateReport } from "@/workflow/gate";
import {
  getStep,
  getStepAgent,
  getStepName,
  nextNonSkippedStep,
  requireCurrentStep,
} from "@/workflow/step-utils";

export async function runApprove(
  ctx: FlowctlContext,
  opts: { by?: string; skipGate?: boolean },
): Promise<void> {
  const by = opts.by ?? "Human";
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);

  if (!opts.skipGate) {
    const gate = await evaluateGate(
      read.data,
      ctx.paths,
      step,
      ctx.projectRoot,
    );
    if (!gate.ok) {
      await writeGateReport(ctx.paths, step, "FAIL", gate.detail, by);
      console.error(chalk.red.bold("\nAPPROVE bị chặn bởi QA Gate."));
      console.error(chalk.red(gate.detail));
      console.error(
        chalk.cyan(`Bypass: flowctl approve --skip-gate --by "${by}"\n`),
      );
      process.exitCode = 1;
      return;
    }
    await writeGateReport(ctx.paths, step, "PASS", gate.detail, by);
    console.log(chalk.green(`QA Gate passed: ${gate.detail}`));
  } else {
    await writeGateReport(
      ctx.paths,
      step,
      "BYPASS",
      "approve --skip-gate was used",
      by,
    );
  }

  const name = getStepName(read.data, step);
  await setPath(stateFile, `steps.${step}.status`, "completed");
  await setPath(stateFile, `steps.${step}.approval_status`, "approved");
  await setPath(stateFile, `steps.${step}.completed_at`, nowTimestamp());
  await setPath(stateFile, `steps.${step}.approved_at`, nowTimestamp());
  await setPath(stateFile, `steps.${step}.approved_by`, by);

  let nextStep = step + 1;
  const fresh = await readState(stateFile);
  if (!fresh.ok) throw new Error(fresh.error);
  while (nextStep <= 9) {
    const status = getStep(fresh.data, nextStep)?.status ?? "pending";
    if (status !== "skipped") break;
    const skippedName = getStepName(fresh.data, nextStep);
    const reason = getStep(fresh.data, nextStep)?.skip_reason ?? "";
    console.log(
      chalk.yellow(`  ⊘ Step ${nextStep} — ${skippedName}: SKIPPED (${reason})`),
    );
    nextStep += 1;
  }

  console.log(chalk.green.bold(`\n✓ Step ${step} — ${name}: APPROVED`));
  console.log(chalk.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const nextActive = nextNonSkippedStep(fresh.data, nextStep);
  if (nextActive !== null && nextActive <= 9) {
    await setPath(stateFile, "current_step", nextActive);
    const nextName = getStepName(fresh.data, nextActive);
    const nextAgent = getStepAgent(fresh.data, nextActive);
    console.log(chalk.cyan.bold(`\n→ Tiếp theo: Step ${nextActive} — ${nextName}`));
    console.log(`Agent: ${chalk.yellow(`@${nextAgent}`)}`);
    console.log(chalk.bold("\nBắt đầu: flowctl start\n"));
  } else {
    await setPath(stateFile, "overall_status", "completed");
    console.log(
      chalk.green.bold("\n🎉 WORKFLOW HOÀN THÀNH! Project đã release.\n"),
    );
  }
}
