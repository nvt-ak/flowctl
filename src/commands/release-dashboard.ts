import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { buildReleaseDashboardMarkdown } from "@/integrations/reporting";
import { readState } from "@/state/reader";
import { evaluateGate } from "@/workflow/gate";
import { requireCurrentStep } from "@/workflow/step-utils";

export async function runReleaseDashboard(
  ctx: FlowctlContext,
  opts: { step?: number; noWrite?: boolean } = {},
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  let step = opts.step;
  if (step === undefined) {
    step = requireCurrentStep(read.data);
  }
  if (Number.isNaN(step) || step < 1 || step > 9) {
    throw new Error("Invalid step");
  }

  let gateOk = false;
  let gateDetail = "gate check not available";
  try {
    const g = await evaluateGate(read.data, ctx.paths, step, ctx.projectRoot, {
      skipEvidence: false,
    });
    gateOk = g.ok;
    gateDetail = g.detail;
  } catch {
    gateDetail = "gate check not available";
  }

  const body = await buildReleaseDashboardMarkdown({
    state: read.data,
    paths: ctx.paths,
    step,
    projectRoot: ctx.projectRoot,
    gateOk,
    gateDetail,
  });

  console.log(body);
  if (!opts.noWrite) {
    await mkdir(ctx.paths.releaseDashboardDir, { recursive: true });
    const outFile = join(ctx.paths.releaseDashboardDir, `step-${step}.md`);
    await writeFile(outFile, `${body}\n`, "utf-8");
    const rel = relative(ctx.projectRoot, outFile);
    console.log(chalk.cyan(`\nSaved: ${rel || outFile}`));
  }
}
