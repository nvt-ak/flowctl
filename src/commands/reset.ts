import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { FlowctlStateSchema, type FlowctlState } from "@/state/schema";
import { atomicJsonWrite } from "@/utils/json";
import { nowTimestamp } from "@/utils/time";

function resetStepsFrom(data: FlowctlState, target: number): FlowctlState {
  const next = structuredClone(data);
  next.current_step = target;
  next.overall_status = "in_progress";
  next.updated_at = nowTimestamp();

  for (let n = target; n <= 9; n++) {
    const key = String(n);
    const s = next.steps[key];
    if (!s) continue;
    s.status = "pending";
    s.started_at = null;
    s.completed_at = null;
    s.approved_at = null;
    s.approved_by = null;
    s.approval_status = null;
    s.deliverables = [];
    s.blockers = [];
    s.decisions = [];
  }
  return FlowctlStateSchema.parse(next);
}

/** Port of cmd_reset — interactive confirm unless --yes */
export async function runReset(
  ctx: FlowctlContext,
  targetStr: string,
  opts: { yes?: boolean } = {},
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const target = Number(targetStr);
  if (!targetStr || Number.isNaN(target) || target < 1 || target > 9) {
    throw new Error("Usage: reset <step_number>");
  }

  console.log(
    chalk.red.bold(`WARNING: Reset flowctl to Step ${target}.`),
  );
  console.log(`All progress from Step ${target} onwards will be deleted.`);

  if (!opts.yes) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question("Confirm? (yes/no): ");
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Cancel.");
      return;
    }
  }

  await atomicJsonWrite(
    stateFile,
    (current) => resetStepsFrom(current, target),
    FlowctlStateSchema,
  );
  console.log(`Workflow reset to Step ${target}`);
}
