import chalk from "chalk";
import { setTimeout as delay } from "node:timers/promises";
import {
  createContext,
  invalidateContextCache,
  type FlowctlContext,
} from "@/cli/context";
import { runInit } from "@/commands/init";
import { runTeam } from "@/commands/team/index";
import type { DispatchOptions } from "@/commands/dispatch/index";
import { readState } from "@/state/reader";

export type BrainstormOptions = {
  project?: string;
  sync?: boolean;
  waitSeconds?: number;
  topic?: string;
  dispatch?: DispatchOptions;
};

/** Port of cmd_brainstorm — auto init + team delegate (+ optional sync). */
export async function runBrainstorm(
  ctx: FlowctlContext,
  opts: BrainstormOptions = {},
): Promise<void> {
  let working = ctx;
  const read = ctx.stateFile ? await readState(ctx.stateFile) : { ok: false as const };
  const step = read.ok ? Number(read.data.current_step) : 0;

  if (!step) {
    const name = opts.project?.trim() || "Auto Brainstorm Project";
    console.log(
      chalk.cyan(`Workflow not initialized, auto init project: ${chalk.bold(name)}`),
    );
    await runInit(ctx, { project: name, noSetup: true });
    invalidateContextCache();
    working = await createContext(ctx.projectRoot, process.env);
  }

  if (opts.topic?.trim()) {
    console.log(chalk.cyan(`Brainstorm topic: ${opts.topic.trim()}`));
  }

  await runTeam(working, "delegate", opts.dispatch ?? {});

  if (opts.sync) {
    const w = opts.waitSeconds ?? 30;
    if (w > 0) {
      console.log(chalk.yellow(`Wait ${w}s before sync...`));
      await delay(w * 1000);
    }
    await runTeam(working, "sync");
  }
}
