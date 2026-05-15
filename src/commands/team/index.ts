import chalk from "chalk";
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { initBudgetArtifacts } from "@/budget/store";
import { manualBreakerReset } from "@/budget/breaker";
import { runCollect } from "@/commands/collect";
import { runDispatch, type DispatchOptions } from "@/commands/dispatch/index";
import { runStart } from "@/commands/start";
import { formatStepSummary } from "@/integrations/reporting";
import { readState } from "@/state/reader";
import { collectStepRoles } from "@/commands/dispatch/roles";
import { pathExists } from "@/utils/fs";
import {
  getStep,
  getStepName,
  requireCurrentStep,
} from "@/workflow/step-utils";

export type TeamMonitorOptions = {
  staleSeconds?: number;
  retryDelaySeconds?: number;
  cleanStalePids?: boolean;
};

export type TeamRecoverOptions = {
  role: string;
  mode?: "resume" | "retry" | "rollback";
  dryRun?: boolean;
};

async function requireStepContext(ctx: FlowctlContext) {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);
  return { stateFile, read, step: String(step) };
}

export async function runTeam(
  ctx: FlowctlContext,
  action: string,
  dispatchOpts: DispatchOptions = {},
  extra: {
    monitor?: TeamMonitorOptions;
    recover?: TeamRecoverOptions;
    budgetResetReason?: string;
  } = {},
): Promise<void> {
  const { read, step } = await requireStepContext(ctx);
  const stepName = getStepName(read.data, Number(step));
  const stepStatus = getStep(read.data, Number(step))?.status ?? "pending";
  const roles = collectStepRoles(read.data, step).join(", ");
  const dispatchDir = join(ctx.paths.dispatchBase, `step-${step}`);
  const reportsDir = join(dispatchDir, "reports");
  const logsDir = join(dispatchDir, "logs");

  switch (action) {
    case "start":
    case "delegate": {
      console.log(chalk.blue.bold("\n[TEAM] PM step-based delegate"));
      console.log(chalk.bold(`Current step: ${step} — ${stepName}`));
      console.log(`Spawn roles: ${chalk.yellow(roles)}`);
      if (stepStatus === "pending") {
        console.log("Step is pending, auto start...");
        await runStart(ctx);
      }
      console.log("Dispatch workers headless...");
      await runDispatch(ctx, { ...dispatchOpts, headless: true });
      return;
    }
    case "sync": {
      console.log(chalk.blue.bold("\n[TEAM] PM sync"));
      await runCollect(ctx);
      const after = await readState(requireStateFile(ctx));
      if (after.ok) {
        console.log(formatStepSummary(after.data, Number(step)));
      }
      return;
    }
    case "status": {
      console.log(chalk.blue.bold("\n[TEAM] PM status"));
      console.log(formatStepSummary(read.data, Number(step)));
      const reportCount = (await pathExists(reportsDir))
        ? (await readdir(reportsDir)).filter((f) => f.endsWith("-report.md")).length
        : 0;
      const logCount = (await pathExists(logsDir))
        ? (await readdir(logsDir)).filter((f) => f.endsWith(".log")).length
        : 0;
      console.log(`Dispatch dir: ${dispatchDir.replace(ctx.projectRoot + "/", "")}`);
      console.log(`Reports: ${reportCount}`);
      console.log(`Logs: ${logCount}\n`);
      return;
    }
    case "monitor":
      await runTeamMonitor(ctx, step, {
        dispatchDir,
        reportsDir,
        roles: collectStepRoles(read.data, step),
        ...extra.monitor,
      });
      return;
    case "recover":
      await runTeamRecover(ctx, step, extra.recover);
      return;
    case "budget-reset": {
      console.log(chalk.blue.bold("\n[TEAM] PM budget reset"));
      await initBudgetArtifacts(
        ctx.paths.budgetStateFile,
        ctx.paths.budgetEventsFile,
      );
      const line = await manualBreakerReset(
        ctx.paths.budgetStateFile,
        extra.budgetResetReason ?? "manual reset by PM",
      );
      console.log(chalk.green(line));
      console.log("");
      return;
    }
    case "run": {
      console.log(chalk.blue.bold("\n[TEAM] PM run loop (single cycle)"));
      console.log(chalk.bold(`Current step: ${step} — ${stepName}`));
      if (stepStatus === "pending") await runStart(ctx);
      await runDispatch(ctx, { ...dispatchOpts, headless: true });
      console.log(chalk.yellow("Workers running in background. Then: flowctl team sync\n"));
      return;
    }
    default:
      throw new Error(
        "Unknown team action. Usage: flowctl team <start|delegate|sync|status|monitor|recover|budget-reset|run>",
      );
  }
}

async function runTeamMonitor(
  ctx: FlowctlContext,
  step: string,
  opts: {
    dispatchDir: string;
    reportsDir: string;
    roles: string[];
    staleSeconds?: number;
    retryDelaySeconds?: number;
    cleanStalePids?: boolean;
  },
): Promise<void> {
  console.log(chalk.blue.bold("\n[TEAM] PM monitor"));
  const staleSeconds = opts.staleSeconds ?? 300;
  const retryDelay = opts.retryDelaySeconds ?? 60;
  if (opts.cleanStalePids) {
    console.log(chalk.yellow("[stale-pids] clean not yet ported — use bash engine"));
  }

  type Entry = { status?: string; pid?: number };
  let idem: Record<string, Entry> = {};
  if (await pathExists(ctx.paths.idempotencyFile)) {
    idem = JSON.parse(
      await readFile(ctx.paths.idempotencyFile, "utf-8"),
    ) as Record<string, Entry>;
  }

  for (const role of opts.roles) {
    const key = `step:${step}:role:${role}:mode:headless`;
    const entry = idem[key] ?? {};
    const reportPath = join(opts.reportsDir, `${role}-report.md`);
    const hasReport = await pathExists(reportPath);
    let status = "pending";
    if (hasReport || entry.status === "completed") status = "done";
    else if (entry.status === "launched") status = "running";
    console.log(
      `- @${role}: ${status} pid=${entry.pid ?? "-"} report=${hasReport ? "yes" : "no"}`,
    );
  }
  console.log(
    `\n(stale_seconds=${staleSeconds}, retry_delay=${retryDelay}s — full monitor in bash)\n`,
  );
}

async function runTeamRecover(
  ctx: FlowctlContext,
  step: string,
  opts?: TeamRecoverOptions,
): Promise<void> {
  const role = (opts?.role ?? "").replace(/^@/, "").trim();
  if (!role) throw new Error("team recover requires --role <name>");
  const mode = opts?.mode ?? "resume";
  if (!["resume", "retry", "rollback"].includes(mode)) {
    throw new Error("Allowed modes: resume | retry | rollback");
  }

  console.log(chalk.blue.bold("\n[TEAM] PM recover"));
  console.log(`Step: ${step} role=@${role} mode=${mode}`);

  if (mode === "rollback") {
    const reportsDir = join(ctx.paths.dispatchBase, `step-${step}`, "reports");
    const logsDir = join(ctx.paths.dispatchBase, `step-${step}`, "logs");
    const reportPath = join(reportsDir, `${role}-report.md`);
    const logPath = join(logsDir, `${role}.log`);
    if (opts?.dryRun) {
      console.log(chalk.cyan(`[dry-run] would rollback @${role}\n`));
      return;
    }
    if (await pathExists(reportPath)) await unlink(reportPath);
    if (await pathExists(logPath)) await unlink(logPath);
    const key = `step:${step}:role:${role}:mode:headless`;
    if (await pathExists(ctx.paths.idempotencyFile)) {
      const data = JSON.parse(
        await readFile(ctx.paths.idempotencyFile, "utf-8"),
      ) as Record<string, Record<string, unknown>>;
      const entry = data[key] ?? {};
      entry.status = "rolled_back";
      entry.pid = null;
      entry.updated_at = new Date().toISOString().slice(0, 19).replace("T", " ");
      data[key] = entry;
      await writeFile(
        ctx.paths.idempotencyFile,
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    }
    console.log(chalk.green(`Rollback completed for @${role}.`));
    console.log(chalk.bold(`Next: flowctl team recover --role ${role} --mode retry\n`));
    return;
  }

  await runDispatch(ctx, {
    headless: true,
    forceRun: true,
    role,
    dryRun: opts?.dryRun,
  });
}
