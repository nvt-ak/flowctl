import chalk from "chalk";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import {
  complexityScore,
  warRoomThreshold,
} from "@/scoring/complexity";
import { getStepName, requireCurrentStep } from "@/workflow/step-utils";
import {
  generateContextDigest,
  warRoomOutputsFresh,
} from "@/commands/war-room/digest";
import {
  generateWarRoomBriefs,
  printWarRoomSpawnBoard,
} from "@/commands/war-room/briefs";

export async function runWarRoom(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));
  const stepName = getStepName(read.data, Number(step));
  const wrDir = join(ctx.paths.dispatchBase, `step-${step}`, "war-room");
  await mkdir(wrDir, { recursive: true });

  const score = complexityScore(read.data, step);
  const thr = warRoomThreshold(read.data, process.env.WF_WAR_ROOM_THRESHOLD);

  if (score < thr) {
    console.log(
      chalk.green(
        `[war-room] Complexity score=${score} (< ${thr}) — War Room skipped.`,
      ),
    );
    console.log("  → Generating context digest directly...\n");
    const rel = await generateContextDigest({
      state: read.data,
      stateFile,
      step,
      stepName,
      wrDir,
      repoRoot: ctx.projectRoot,
      dispatchBase: ctx.paths.dispatchBase,
      mode: "simple",
    });
    console.log(chalk.green(`✓ Context digest: ${rel}\n`));
    return;
  }

  if (await warRoomOutputsFresh(wrDir, stateFile)) {
    console.log(
      chalk.green(
        "[war-room] Reusing PM/TechLead outputs (newer than state) — skip regeneration.",
      ),
    );
    const rel = await generateContextDigest({
      state: read.data,
      stateFile,
      step,
      stepName,
      wrDir,
      repoRoot: ctx.projectRoot,
      dispatchBase: ctx.paths.dispatchBase,
      mode: "full",
    });
    console.log(chalk.cyan(`  Context digest: ${rel}`));
    console.log(
      chalk.bold(
        "  Continue: flowctl cursor-dispatch --skip-war-room or flowctl cursor-dispatch --merge\n",
      ),
    );
    return;
  }

  console.log(
    chalk.magenta.bold(
      `\n╔══════════════════════════════════════════════════════════════╗`,
    ),
  );
  console.log(
    chalk.magenta.bold(`║  🔥 WAR ROOM — Step ${step}: ${stepName}`),
  );
  console.log(
    chalk.magenta.bold(
      `║  Complexity: ${score}/5 — PM + TechLead align BEFORE dispatching team`,
    ),
  );
  console.log(
    chalk.magenta.bold(`╚══════════════════════════════════════════════════════════════╝\n`),
  );

  await generateWarRoomBriefs({
    state: read.data,
    step,
    stepName,
    wrDir,
    repoRoot: ctx.projectRoot,
    dispatchBase: ctx.paths.dispatchBase,
    retroDir: ctx.paths.retroDir,
  });
  console.log(chalk.green(`✓ War Room briefs at ${wrDir.replace(ctx.projectRoot + "/", "")}/`));

  printWarRoomSpawnBoard(wrDir, ctx.projectRoot);

  console.log(chalk.yellow.bold("⏸  After PM + TechLead finish War Room:"));
  console.log(chalk.bold("  Run: flowctl war-room merge\n"));
}
