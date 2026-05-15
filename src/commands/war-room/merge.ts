import chalk from "chalk";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { pathExists } from "@/utils/fs";
import { getStepName, requireCurrentStep } from "@/workflow/step-utils";
import { generateContextDigest } from "@/commands/war-room/digest";

export async function runWarRoomMerge(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));
  const stepName = getStepName(read.data, Number(step));
  const wrDir = join(ctx.paths.dispatchBase, `step-${step}`, "war-room");

  const pmOut = join(wrDir, "pm-analysis.md");
  const tlOut = join(wrDir, "tech-lead-assessment.md");
  if (!(await pathExists(pmOut)) && !(await pathExists(tlOut))) {
    console.log(chalk.red("[war-room merge] Chưa có output từ PM hoặc TechLead."));
    console.log(`  Cần: ${pmOut.replace(ctx.projectRoot + "/", "")}`);
    throw new Error("War room outputs missing");
  }

  await generateContextDigest({
    state: read.data,
    stateFile,
    step,
    stepName,
    wrDir,
    repoRoot: ctx.projectRoot,
    dispatchBase: ctx.paths.dispatchBase,
    mode: "full",
  });

  console.log(
    chalk.green("✓ Context digest đã tạo — sẵn sàng chạy cursor-dispatch\n"),
  );
}
