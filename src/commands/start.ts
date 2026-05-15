import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { setPath } from "@/state/writer";
import { nowTimestamp } from "@/utils/time";
import {
  activeIndexForStep,
  advancePastSkipped,
  countActiveSteps,
  getStepAgent,
  getStepName,
  requireCurrentStep,
} from "@/workflow/step-utils";

export async function runStart(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  let step = requireCurrentStep(read.data);
  let state = read.data;

  const { step: afterSkip, skipped } = advancePastSkipped(state, step);
  for (const s of skipped) {
    console.log(
      chalk.yellow(`  ⊘ Step ${s.step} — ${s.name}: SKIPPED (${s.reason})`),
    );
  }
  step = afterSkip;
  if (step > 9) {
    await setPath(stateFile, "overall_status", "completed");
    console.log(
      chalk.green.bold(
        "\n🎉 WORKFLOW COMPLETED — all steps completed/skipped.\n",
      ),
    );
    return;
  }

  if (skipped.length > 0) {
    await setPath(stateFile, "current_step", step);
  }

  await setPath(stateFile, `steps.${step}.status`, "in_progress");
  await setPath(stateFile, `steps.${step}.started_at`, nowTimestamp());

  const fresh = await readState(stateFile);
  if (!fresh.ok) throw new Error(fresh.error);
  state = fresh.data;

  const name = getStepName(state, step);
  const agent = getStepAgent(state, step);
  const activeCount = countActiveSteps(state);
  const activeIndex = activeIndexForStep(state, step);

  console.log(
    chalk.green.bold(
      `\nStep ${step} (${activeIndex}/${activeCount} active) — ${name} started`,
    ),
  );
  console.log(`Main agent: ${chalk.yellow(`@${agent}`)}`);
  console.log("\nLoad workflow context:");
  console.log(`  ${chalk.cyan("wf_step_context()")}          ← decisions + blockers`);
  if (step >= 4) {
    console.log(`  ${chalk.cyan("cat graphify-out/GRAPH_REPORT.md")} ← code structure`);
  }
  console.log(`\nView agent guide: ${chalk.bold(`.cursor/agents/${agent}-agent.md`)}\n`);
}
