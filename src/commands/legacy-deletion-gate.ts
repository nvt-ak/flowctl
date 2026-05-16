/**
 * `flowctl legacy-deletion-gate` — cleanup plan §1E gate before removing large legacy files.
 */
import { execa } from "execa";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { evaluateLegacyDeletionGate } from "@/cleanup/legacy-deletion-gate";
import { LARGE_LEGACY_DELETIONS } from "@/cleanup/legacy-deletions";

export type LegacyDeletionGateCliOptions = {
  /** Only read coverage summary + scan src imports (skip subprocess runs). */
  skipRun?: boolean;
};

export async function runLegacyDeletionGate(
  ctx: FlowctlContext,
  opts: LegacyDeletionGateCliOptions = {},
): Promise<void> {
  const root = ctx.projectRoot;
  const result = await evaluateLegacyDeletionGate({
    projectRoot: root,
    skipRun: opts.skipRun === true,
    runTypecheck: opts.skipRun
      ? undefined
      : async () => {
          await execa("npx", ["tsc", "--noEmit"], { cwd: root, stdio: "inherit" });
        },
    runUnitCoverage: opts.skipRun
      ? undefined
      : async () => {
          await execa("bun", ["vitest", "run", "--coverage"], { cwd: root, stdio: "inherit" });
        },
    runIntegration: opts.skipRun
      ? undefined
      : async () => {
          await execa("bun", ["vitest", "run", "test/integration", "--passWithNoTests"], {
            cwd: root,
            stdio: "inherit",
          });
        },
  });

  console.log(chalk.bold("\nLarge legacy deletion gate (cleanup plan §1E)\n"));
  for (const entry of LARGE_LEGACY_DELETIONS) {
    const cond = entry.conditions.join(", ");
    console.log(`  ${entry.path} (~${entry.approxLines} lines) — ${cond}`);
  }
  console.log("");
  for (const check of result.checks) {
    const icon = check.pass ? chalk.green("✓") : chalk.red("✗");
    console.log(`${icon} ${check.name}: ${check.detail}`);
  }
  console.log("");
  if (result.pass) {
    console.log(chalk.green("GATE PASS — safe to proceed with large legacy deletions (per-phase conditions still apply)."));
  } else {
    console.log(chalk.red("GATE FAIL — do not delete large legacy files until all checks pass."));
    process.exitCode = 1;
  }
}
