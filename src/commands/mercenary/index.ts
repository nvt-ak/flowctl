import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { requireCurrentStep } from "@/workflow/step-utils";
import { join } from "node:path";
import { scanMercenaryRequests } from "@/commands/mercenary/scan";
import { runMercenarySpawn, type MercenarySpawnOptions } from "@/commands/mercenary/spawn";

export async function runMercenary(
  ctx: FlowctlContext,
  subcmd: string,
  opts: MercenarySpawnOptions = {},
): Promise<void> {
  switch (subcmd) {
    case "scan":
      await runMercenaryScan(ctx);
      return;
    case "spawn":
      await runMercenarySpawn(ctx, opts);
      return;
    default:
      console.log("Usage: mercenary [scan|spawn]");
  }
}

async function runMercenaryScan(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = String(requireCurrentStep(read.data));
  const reportsDir = join(ctx.paths.dispatchBase, `step-${step}`, "reports");
  const requests = await scanMercenaryRequests(reportsDir, ctx.projectRoot);

  if (requests.length === 0) {
    console.log(
      chalk.green(`✓ No NEEDS_SPECIALIST requests in step ${step} reports.\n`),
    );
    return;
  }

  console.log(chalk.yellow.bold(`\n🔍 MERCENARY REQUESTS — Step ${step}`));
  console.log(`  ${requests.length} request(s):\n`);
  requests.forEach((r, i) => {
    console.log(`  [${i + 1}] type: ${r.type}`);
    console.log(`      by: @${r.requested_by}`);
    console.log(`      query: ${r.query ?? "?"}`);
    console.log(`      blocking: ${r.blocking ?? "?"}\n`);
  });
  console.log(chalk.bold("  Run flowctl mercenary spawn to create spawn board.\n"));
}
