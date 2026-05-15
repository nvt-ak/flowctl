import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { appendPath, setPath } from "@/state/writer";
import { todayIso } from "@/utils/time";
import { getStepName, requireCurrentStep } from "@/workflow/step-utils";

export async function runReject(
  ctx: FlowctlContext,
  reason = "No reason",
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);
  const name = getStepName(read.data, step);

  await setPath(stateFile, `steps.${step}.approval_status`, "rejected");
  await setPath(stateFile, `steps.${step}.status`, "in_progress");
  await appendPath(stateFile, `steps.${step}.decisions`, {
    id: `R${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
    type: "rejection",
    description: reason,
    date: todayIso(),
  });

  console.log(chalk.red.bold(`\n✗ Step ${step} — ${name}: REJECTED`));
  console.log(`Reason: ${reason}`);
  console.log(chalk.bold("\nAddress concerns and run again: flowctl approve\n"));
}
