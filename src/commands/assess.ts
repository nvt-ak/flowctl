import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { getStep, requireCurrentStep } from "@/workflow/step-utils";

const ASSESS_HINTS: Record<number, string> = {
  2: "Skip if: hotfix is obvious, no architecture changes",
  3: "Skip if: API-only, bug fix without UI, backend refactor",
  5: "Skip if: no UI changes, API-only service",
  6: "Skip if: only fixing one isolated service, no cross-service changes",
  7: "Rarely skip — only if hotfix is critical for production",
  8: "Skip if: infrastructure is already in place, only small hotfix",
};

export async function runAssess(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const current = requireCurrentStep(read.data);
  const project = read.data.project_name ?? "";

  console.log(chalk.blue.bold("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.blue.bold(`   Workflow Assessment — ${project}`));
  console.log(chalk.blue.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
  console.log(
    chalk.cyan("PM: Evaluate each step below and decide to skip if not needed.\n"),
  );
  console.log("  Step  Status    Name                    Skip hint");
  console.log(`  ${"─".repeat(70)}`);

  for (let n = 1; n <= 9; n++) {
    const s = getStep(read.data, n);
    const status = s?.status ?? "pending";
    const name = (s?.name ?? "").padEnd(22);
    const hint = ASSESS_HINTS[n] ?? "";
    const marker = n === current ? "→" : " ";
    console.log(`  ${marker} ${n}    ${status.padEnd(9)}  ${name} ${hint}`);
  }

  console.log(chalk.cyan("\nAvailable presets:"));
  console.log("  --preset hotfix        → skip steps 2,3,5,6");
  console.log("  --preset api-only      → skip steps 3,5");
  console.log("");
}
