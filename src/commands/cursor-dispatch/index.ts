import chalk from "chalk";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { runDispatch } from "@/commands/dispatch/index";
import { printSpawnBoard } from "@/commands/cursor-dispatch/board";
import {
  bumpDispatchCount,
  evaluateWarRoomGate,
  persistDispatchFlags,
  printWarRoomPause,
} from "@/commands/cursor-dispatch/war-room-gate";
import { runMcpHealthCheck } from "@/utils/mcp-health";
import { getStepName, requireCurrentStep } from "@/workflow/step-utils";

export type CursorDispatchOptions = {
  skipWarRoom?: boolean;
  merge?: boolean;
  highRisk?: boolean;
  impactedModules?: number;
  forceWarRoom?: boolean;
};

export async function runCursorDispatch(
  ctx: FlowctlContext,
  opts: CursorDispatchOptions = {},
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));

  await runMcpHealthCheck(ctx);

  if (opts.merge) {
    console.log(
      chalk.cyan(
        "→ War Room merge: run `flowctl war-room merge` (bash) then `flowctl cursor-dispatch` again.\n",
      ),
    );
    return;
  }

  await persistDispatchFlags(stateFile, step, {
    highRisk: opts.highRisk,
    impactedModules: opts.impactedModules,
  });

  const fresh = await readState(stateFile);
  if (!fresh.ok) throw new Error(fresh.error);

  if (!opts.skipWarRoom) {
    const gate = await evaluateWarRoomGate(
      fresh.data,
      step,
      ctx.paths.dispatchBase,
      { forceWarRoom: opts.forceWarRoom },
    );

    if (gate.action === "run") {
      printWarRoomPause(gate.score, gate.threshold);
      await bumpDispatchCount(stateFile, step);
      console.log(
        chalk.yellow(
          "War Room body not ported to TS — run: flowctl war-room (bash) or --skip-war-room",
        ),
      );
      return;
    }
    if (gate.action === "reuse") {
      console.log(
        chalk.green(
          `[cursor-dispatch] Complexity=${gate.score}/5 — War Room outputs still valid, reusing.\n`,
        ),
      );
    } else {
      console.log(
        chalk.green(
          `[cursor-dispatch] Complexity=${gate.score}/5 (< ${gate.threshold}) → Skip War Room\n`,
        ),
      );
    }
  }

  await bumpDispatchCount(stateFile, step);

  console.log(chalk.blue("[cursor-dispatch] Generating briefs..."));
  await runDispatch(ctx, { dryRun: true, headless: false });

  const dispatchDir = join(ctx.paths.dispatchBase, `step-${step}`);
  const stepName = getStepName(fresh.data, Number(step));

  await printSpawnBoard({
    state: fresh.data,
    step,
    stepName,
    projectRoot: ctx.projectRoot,
    dispatchDir,
    stateFile,
  });
}
