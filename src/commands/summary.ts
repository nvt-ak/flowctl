import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { formatStepSummary } from "@/integrations/reporting";
import { readState } from "@/state/reader";
import { requireCurrentStep } from "@/workflow/step-utils";

export async function runSummary(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);
  console.log(chalk.bold(formatStepSummary(read.data, step)));
}
