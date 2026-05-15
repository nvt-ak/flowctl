import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { formatApprovalHistory } from "@/integrations/reporting";
import { readState } from "@/state/reader";

export async function runHistory(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  console.log(chalk.bold(formatApprovalHistory(read.data)));
}
