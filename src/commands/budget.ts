import chalk from "chalk";
import { readFile } from "node:fs/promises";
import type { FlowctlContext } from "@/cli/context";
import { initBudgetArtifacts } from "@/budget/store";
import { evaluateBreakerCheck } from "@/budget/breaker";
import { pathExists } from "@/utils/fs";

/** Show budget breaker snapshot (read-only). */
export async function runBudgetStatus(ctx: FlowctlContext): Promise<void> {
  await initBudgetArtifacts(ctx.paths.budgetStateFile, ctx.paths.budgetEventsFile);
  if (!(await pathExists(ctx.paths.budgetStateFile))) {
    console.log(chalk.yellow("Budget state not initialized.\n"));
    return;
  }
  const state = JSON.parse(
    await readFile(ctx.paths.budgetStateFile, "utf-8"),
  ) as {
    breaker?: { state?: string; cooldown_seconds?: number };
    run?: Record<string, unknown>;
  };
  const breaker = state.breaker ?? {};
  const run = state.run ?? {};
  const check = await evaluateBreakerCheck(ctx.paths.budgetStateFile, "pm");
  console.log(chalk.bold("\nBudget status"));
  console.log(`  Breaker: ${breaker.state ?? "closed"}`);
  console.log(`  Cooldown: ${breaker.cooldown_seconds ?? 300}s`);
  console.log(`  Check: ${check.line}`);
  console.log(
    `  Run: tokens=${run.consumed_tokens_est ?? 0} runtime=${run.consumed_runtime_seconds ?? 0}s cost=${run.consumed_cost_usd ?? 0}\n`,
  );
}
