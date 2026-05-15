import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { evaluateGate, writeGateReport } from "@/workflow/gate";
import { requireCurrentStep } from "@/workflow/step-utils";

export async function runGateCheck(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);

  const result = await evaluateGate(read.data, ctx.paths, step, ctx.projectRoot);
  if (result.ok) {
    await writeGateReport(ctx.paths, step, "PASS", result.detail, "gate-check");
    console.log(chalk.green.bold("QA Gate: PASS"));
    console.log(`${result.detail}\n`);
    return;
  }

  await writeGateReport(ctx.paths, step, "FAIL", result.detail, "gate-check");
  console.log(chalk.red.bold("QA Gate: FAIL"));
  console.log(chalk.red(`${result.detail}\n`));
  process.exitCode = 1;
}
