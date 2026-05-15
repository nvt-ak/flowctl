import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { appendPath } from "@/state/writer";
import { todayIso } from "@/utils/time";
import { requireCurrentStep } from "@/workflow/step-utils";

export async function runDecision(
  ctx: FlowctlContext,
  description: string,
): Promise<void> {
  if (!description.trim()) {
    throw new Error("Decision description is required");
  }
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);
  const id = `D${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;

  await appendPath(stateFile, `steps.${step}.decisions`, {
    id,
    description,
    date: todayIso(),
    type: "decision",
  });

  console.log(chalk.cyan(`\nDecision recorded: [${id}] ${description}\n`));
}
