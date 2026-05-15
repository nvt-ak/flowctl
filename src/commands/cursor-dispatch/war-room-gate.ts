import chalk from "chalk";
import { join } from "node:path";
import type { FlowctlState } from "@/state/schema";
import { readState } from "@/state/reader";
import { setPath } from "@/state/writer";
import {
  complexityScore,
  warRoomThreshold,
} from "@/scoring/complexity";
import { pathExists } from "@/utils/fs";

export type WarRoomGateResult =
  | { action: "skip"; score: number; threshold: number }
  | { action: "run"; score: number; threshold: number; reason: string }
  | { action: "reuse"; score: number; threshold: number };

export type CursorDispatchFlags = {
  highRisk?: boolean;
  impactedModules?: number;
  forceWarRoom?: boolean;
};

export async function persistDispatchFlags(
  stateFile: string,
  step: string,
  flags: CursorDispatchFlags,
): Promise<void> {
  if (flags.highRisk) {
    await setPath(stateFile, `steps.${step}.dispatch_risk.high_risk`, true);
  }
  if (
    flags.impactedModules !== undefined &&
    Number.isFinite(flags.impactedModules)
  ) {
    await setPath(
      stateFile,
      `steps.${step}.dispatch_risk.impacted_modules`,
      flags.impactedModules,
    );
  }
}

export async function evaluateWarRoomGate(
  state: FlowctlState,
  step: string,
  dispatchBase: string,
  flags: CursorDispatchFlags,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WarRoomGateResult> {
  const score = complexityScore(state, step);
  const threshold = warRoomThreshold(state, env.WF_WAR_ROOM_THRESHOLD);
  const force =
    flags.forceWarRoom === true || env.WF_FORCE_WAR_ROOM === "1";

  if (force || score >= threshold) {
    const wrDir = join(dispatchBase, `step-${step}`, "war-room");
    const digest = join(wrDir, "context-digest.md");
    if (!force && (await pathExists(digest))) {
      return { action: "reuse", score, threshold };
    }
    return {
      action: "run",
      score,
      threshold,
      reason: force ? "force-war-room" : `score ${score} >= ${threshold}`,
    };
  }

  return { action: "skip", score, threshold };
}

export function printWarRoomPause(
  score: number,
  threshold: number,
): void {
  console.log(
    chalk.magenta.bold(
      `[cursor-dispatch] Complexity=${score}/5 (threshold=${threshold}) → War Room trước khi dispatch team`,
    ),
  );
  console.log(chalk.yellow("⏸  Chờ War Room hoàn thành, sau đó:"));
  console.log(chalk.bold("  flowctl cursor-dispatch --merge"));
  console.log(chalk.bold("  flowctl cursor-dispatch --skip-war-room\n"));
}

export async function bumpDispatchCount(
  stateFile: string,
  step: string,
): Promise<void> {
  const read = await readState(stateFile);
  if (!read.ok) return;
  const dr = read.data.steps[step]?.dispatch_risk;
  const count = Number(dr?.dispatch_count ?? 0) + 1;
  await setPath(stateFile, `steps.${step}.dispatch_risk.dispatch_count`, count);
}
