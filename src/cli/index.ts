#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getOrCreateContext,
  invalidateContextCache,
  type FlowctlContext,
} from "@/cli/context";
import { runAssess } from "@/commands/assess";
import { runApprove } from "@/commands/approve";
import { runBlockerAdd, runBlockerReconcile, runBlockerResolve } from "@/commands/blocker";
import { runDecision } from "@/commands/decision";
import { runGateCheck } from "@/commands/gate";
import { runReject } from "@/commands/reject";
import { runSkip, runUnskip } from "@/commands/skip";
import { runStart } from "@/commands/start";
import { runStatus } from "@/commands/status";
import { runDispatch } from "@/commands/dispatch/index";
import { runCursorDispatch } from "@/commands/cursor-dispatch/index";
import { runFlow } from "@/commands/flow/index";
import { runFork } from "@/commands/fork";
import { runCollect } from "@/commands/collect";
import { runPlan } from "@/commands/plan";
import { runRetro } from "@/commands/retro";
import { runBrainstorm } from "@/commands/brainstorm";
import { runReset } from "@/commands/reset";
import { runSummary } from "@/commands/summary";
import { runHistory } from "@/commands/history";
import { runReleaseDashboard } from "@/commands/release-dashboard";
import { runInit } from "@/commands/init";
import { runComplexity } from "@/commands/complexity";
import { runBudgetStatus } from "@/commands/budget";
import { runWarRoom } from "@/commands/war-room/index";
import { runWarRoomMerge } from "@/commands/war-room/merge";
import { runMercenary } from "@/commands/mercenary/index";
import { runTeam, type TeamRecoverOptions } from "@/commands/team/index";
import { acquireFlowLock } from "@/utils/lock";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"),
) as { version: string };

const FLOW_LOCKED_COMMANDS = new Set([
  "start",
  "gate-check",
  "approve",
  "reject",
  "conditional",
  "blocker",
  "decision",
  "dispatch",
  "cursor-dispatch",
  "collect",
  "team",
  "reset",
  "brainstorm",
  "release-dashboard",
  "war-room",
  "mercenary",
  "retro",
  "complexity",
  "audit-tokens",
  "skip",
  "unskip",
  "assess",
]);

const lockReleases = new Map<string, () => Promise<void>>();

async function getContext(): Promise<FlowctlContext> {
  return getOrCreateContext(process.cwd(), process.env);
}

async function withFlowLock<T>(
  commandName: string,
  fn: (ctx: FlowctlContext) => Promise<T>,
): Promise<T> {
  const ctx = await getContext();
  if (!FLOW_LOCKED_COMMANDS.has(commandName)) {
    return fn(ctx);
  }
  const release = await acquireFlowLock(ctx.paths.workflowLockDir);
  lockReleases.set(commandName, release);
  try {
    return await fn(ctx);
  } finally {
    const releaseFn = lockReleases.get(commandName);
    if (releaseFn) {
      await releaseFn();
      lockReleases.delete(commandName);
    }
  }
}

async function runCommand(
  commandName: string,
  fn: (ctx: FlowctlContext) => Promise<void>,
): Promise<void> {
  try {
    await withFlowLock(commandName, fn);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
  }
}

const program = new Command();

program
  .name("flowctl")
  .description("Workflow orchestration for Cursor (TypeScript engine)")
  .version(pkg.version, "-v, --version", "Show version number");

program
  .command("status")
  .description("Xem trạng thái workflow")
  .alias("s")
  .option("--all", "List all projects in registry")
  .action(async (opts: { all?: boolean }) => {
    await runCommand("status", (ctx) => runStatus(ctx, { all: opts.all }));
  });

program
  .command("start")
  .description("Bắt đầu step hiện tại")
  .action(async () => {
    await runCommand("start", runStart);
  });

program
  .command("approve")
  .description("Approve step hiện tại và advance")
  .alias("a")
  .option("--by <name>", "Người approve", "Human")
  .option("--skip-gate", "Bypass QA gate")
  .action(async (opts: { by?: string; skipGate?: boolean }) => {
    await runCommand("approve", (ctx) =>
      runApprove(ctx, { by: opts.by, skipGate: opts.skipGate }),
    );
  });

program
  .command("gate-check")
  .description("Kiểm tra QA gate cho step hiện tại")
  .alias("gate")
  .action(async () => {
    await runCommand("gate-check", runGateCheck);
  });

program
  .command("reject [reason]")
  .description("Reject step với lý do")
  .alias("r")
  .action(async (reason: string | undefined) => {
    await runCommand("reject", (ctx) => runReject(ctx, reason));
  });

program
  .command("skip")
  .description("Skip workflow steps")
  .option("--steps <list>", "Steps to skip (comma or space separated)")
  .option("-s, --step <n>", "Alias for single step")
  .option("-p, --preset <name>", "Skip preset")
  .option("--type <t>", "Reason type")
  .option("-t, --type <t>", "Reason type (alias)")
  .option("--reason <text>", "Skip reason")
  .option("-r, --reason <text>", "Skip reason (alias)")
  .option("--by <name>", "Who skipped", "PM")
  .action(async (opts: Record<string, string | undefined>) => {
    await runCommand("skip", (ctx) =>
      runSkip(ctx, {
        steps: opts.steps ?? opts.step,
        preset: opts.preset ?? opts.p,
        reasonType: opts.type ?? opts.t,
        reason: opts.reason ?? opts.r,
        by: opts.by,
      }),
    );
  });

program
  .command("unskip")
  .description("Đảo skip — đặt step về pending")
  .requiredOption("-s, --step <n>", "Step number (1–9)")
  .option("--reason <text>", "Lý do unskip")
  .option("-r, --reason <text>", "Lý do (alias)")
  .action(async (opts: Record<string, string | undefined>) => {
    await runCommand("unskip", (ctx) =>
      runUnskip(ctx, {
        step: opts.step,
        reason: opts.reason ?? opts.r,
      }),
    );
  });

program
  .command("assess")
  .description("Đánh giá steps để quyết định skip")
  .action(async () => {
    await runCommand("assess", runAssess);
  });

const blockerCmd = program
  .command("blocker")
  .description("Quản lý blockers");

blockerCmd
  .command("add <description>")
  .description("Thêm blocker")
  .action(async (description: string) => {
    await runCommand("blocker", (ctx) => runBlockerAdd(ctx, description));
  });

blockerCmd
  .command("resolve <id>")
  .description("Resolve blocker")
  .action(async (id: string) => {
    await runCommand("blocker", (ctx) => runBlockerResolve(ctx, id));
  });

blockerCmd
  .command("reconcile")
  .description("Auto-resolve blockers khi điều kiện đã thỏa")
  .action(async () => {
    await runCommand("blocker", (ctx) => runBlockerReconcile(ctx));
  });

program
  .command("decision <description>")
  .description("Ghi nhận quyết định")
  .alias("d")
  .action(async (description: string) => {
    await runCommand("decision", (ctx) => runDecision(ctx, description));
  });

program
  .command("conditional [items]")
  .description("Alias for reject with conditional approval note")
  .action(async (items: string | undefined) => {
    await runCommand("conditional", (ctx) =>
      runReject(ctx, items ?? "Conditional approval — items pending"),
    );
  });

program
  .command("dispatch")
  .description("Dispatch workers for current step")
  .option("--launch", "Auto-launch workers")
  .option("--headless", "Headless worker mode")
  .option("--trust", "Request workspace trust")
  .option("--dry-run", "Generate briefs only")
  .option("--force-run", "Bypass idempotency skip")
  .option("--max-retries <n>", "Max retries per role", "3")
  .option("--role <name>", "Dispatch single role")
  .action(async (opts: Record<string, string | boolean | undefined>) => {
    await runCommand("dispatch", (ctx) =>
      runDispatch(ctx, {
        launch: opts.launch === true,
        headless: opts.headless === true,
        trust: opts.trust === true,
        dryRun: opts.dryRun === true,
        forceRun: opts.forceRun === true,
        maxRetries: typeof opts.maxRetries === "string" ? opts.maxRetries : "3",
        role: typeof opts.role === "string" ? opts.role : undefined,
      }),
    );
  });

program
  .command("cursor-dispatch")
  .alias("cd")
  .description("Cursor-native parallel dispatch (War Room gate + spawn board)")
  .option("--skip-war-room", "Skip War Room phase")
  .option("--merge", "Merge War Room outputs (bash war-room)")
  .option("--high-risk", "Flag high risk on step")
  .option("--impacted-modules <n>", "Impacted module count", (v) => Number(v))
  .option("--force-war-room", "Always run War Room")
  .action(async (opts: Record<string, string | boolean | number | undefined>) => {
    await runCommand("cursor-dispatch", (ctx) =>
      runCursorDispatch(ctx, {
        skipWarRoom: opts.skipWarRoom === true,
        merge: opts.merge === true,
        highRisk: opts.highRisk === true,
        impactedModules:
          typeof opts.impactedModules === "number"
            ? opts.impactedModules
            : undefined,
        forceWarRoom: opts.forceWarRoom === true,
      }),
    );
  });

const flowCmd = program.command("flow").alias("flows").description("Multi-flow registry");

flowCmd
  .command("list")
  .alias("ls")
  .description("List flows in .flowctl/flows.json")
  .action(async () => {
    const ctx = await getContext();
    await runFlow(ctx, "list", []);
  });

flowCmd
  .command("new")
  .description("Create a new flow and set active")
  .option("--label <text>", "Flow label")
  .option("--project <name>", "Project name")
  .action(async (opts: { label?: string; project?: string }) => {
    const ctx = await getContext();
    await runFlow(ctx, "new", [], { label: opts.label, project: opts.project });
  });

flowCmd
  .command("switch <flowId>")
  .alias("sw")
  .description("Switch active flow in flows.json")
  .action(async (flowId: string) => {
    const ctx = await getContext();
    await runFlow(ctx, "switch", [flowId]);
  });

program
  .command("collect")
  .description("Collect worker reports into workflow state")
  .action(async () => {
    await runCommand("collect", runCollect);
  });

program
  .command("complexity")
  .description("Score step complexity and War Room hints")
  .action(async () => {
    await runCommand("complexity", runComplexity);
  });

program
  .command("budget")
  .description("Budget breaker status")
  .action(async () => {
    const ctx = await getContext();
    try {
      await runBudgetStatus(ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exitCode = 1;
    }
  });

const warRoomCmd = program
  .command("war-room")
  .alias("wr")
  .description("War Room protocol (PM + Tech Lead)");

warRoomCmd
  .command("merge")
  .description("Merge War Room outputs into context-digest.md")
  .action(async () => {
    await runCommand("war-room", runWarRoomMerge);
  });

warRoomCmd.action(async () => {
  await runCommand("war-room", runWarRoom);
});

const mercenaryCmd = program
  .command("mercenary")
  .alias("merc")
  .description("Mercenary pool (scan / spawn)");

mercenaryCmd
  .command("scan")
  .description("Scan reports for NEEDS_SPECIALIST")
  .action(async () => {
    await runCommand("mercenary", (ctx) => runMercenary(ctx, "scan"));
  });

mercenaryCmd
  .command("spawn")
  .description("Spawn mercenary board from scan results")
  .option("--timeout <seconds>", "Mercenary timeout hint", (v) => Number(v))
  .action(async (opts: { timeout?: number }) => {
    await runCommand("mercenary", (ctx) =>
      runMercenary(ctx, "spawn", { timeout: opts.timeout }),
    );
  });

mercenaryCmd.action(async () => {
  await runCommand("mercenary", (ctx) => runMercenary(ctx, "scan"));
});

const teamCmd = program.command("team").description("PM team orchestration");

const teamDispatchOpts = (opts: Record<string, string | boolean | undefined>) => ({
  launch: opts.launch === true,
  headless: opts.headless === true,
  trust: opts.trust === true,
  dryRun: opts.dryRun === true,
  forceRun: opts.forceRun === true,
  maxRetries: typeof opts.maxRetries === "string" ? opts.maxRetries : undefined,
  role: typeof opts.role === "string" ? opts.role : undefined,
});

const dispatchPassThrough = [
  ["--launch", "Pass through to dispatch"],
  ["--headless", "Pass through to dispatch"],
  ["--trust", "Pass through to dispatch"],
  ["--dry-run", "Pass through to dispatch"],
  ["--force-run", "Pass through to dispatch"],
  ["--max-retries <n>", "Pass through to dispatch"],
  ["--role <name>", "Pass through to dispatch"],
] as const;

function addDispatchPassThrough(cmd: ReturnType<typeof teamCmd.command>) {
  for (const [flag, desc] of dispatchPassThrough) {
    cmd.option(flag, desc);
  }
  return cmd;
}

addDispatchPassThrough(
  teamCmd.command("start").description("Start step and delegate headless"),
).action(async (opts: Record<string, string | boolean | undefined>) => {
  await runCommand("team", (ctx) => runTeam(ctx, "start", teamDispatchOpts(opts)));
});

addDispatchPassThrough(
  teamCmd.command("delegate").description("Delegate headless workers"),
).action(async (opts: Record<string, string | boolean | undefined>) => {
  await runCommand("team", (ctx) =>
    runTeam(ctx, "delegate", teamDispatchOpts(opts)),
  );
});

teamCmd
  .command("sync")
  .description("Collect reports and print summary")
  .action(async () => {
    await runCommand("team", (ctx) => runTeam(ctx, "sync"));
  });

teamCmd
  .command("status")
  .description("Team status + summary")
  .action(async () => {
    await runCommand("team", (ctx) => runTeam(ctx, "status"));
  });

teamCmd
  .command("monitor")
  .description("Monitor worker status (simplified)")
  .option("--stale-seconds <n>", "Stale threshold", (v) => Number(v))
  .option("--retry-delay-seconds <n>", "Retry delay hint", (v) => Number(v))
  .option("--stale-pids", "Clean stale PIDs (bash only)")
  .action(async (opts: {
    staleSeconds?: number;
    retryDelaySeconds?: number;
    stalePids?: boolean;
  }) => {
    await runCommand("team", (ctx) =>
      runTeam(ctx, "monitor", {}, {
        monitor: {
          staleSeconds: opts.staleSeconds,
          retryDelaySeconds: opts.retryDelaySeconds,
          cleanStalePids: opts.stalePids === true,
        },
      }),
    );
  });

teamCmd
  .command("recover")
  .description("Recover a stuck role")
  .requiredOption("--role <name>", "Role to recover")
  .option("--mode <mode>", "resume|retry|rollback", "retry")
  .option("--dry-run", "Dry run")
  .action(async (opts: { role: string; mode?: string; dryRun?: boolean }) => {
    await runCommand("team", (ctx) =>
      runTeam(ctx, "recover", {}, {
        recover: {
          role: opts.role,
          mode: (opts.mode as TeamRecoverOptions["mode"]) ?? "retry",
          dryRun: opts.dryRun === true,
        },
      }),
    );
  });

teamCmd
  .command("budget-reset")
  .description("Reset budget breaker")
  .option("--reason <text>", "Reset reason")
  .action(async (opts: { reason?: string }) => {
    await runCommand("team", (ctx) =>
      runTeam(ctx, "budget-reset", {}, {
        budgetResetReason: opts.reason,
      }),
    );
  });

addDispatchPassThrough(
  teamCmd.command("run").description("Single delegate cycle"),
).action(async (opts: Record<string, string | boolean | undefined>) => {
  await runCommand("team", (ctx) => runTeam(ctx, "run", teamDispatchOpts(opts)));
});

teamCmd.action(async () => {
  await runCommand("team", (ctx) => runTeam(ctx, "status"));
});

program
  .command("plan")
  .description("Generate workflows/plans/plan.md from state")
  .alias("plan-md")
  .action(async () => {
    await runCommand("plan", runPlan);
  });

program
  .command("generate-plan")
  .description("Alias: generate plan.md from state")
  .action(async () => {
    await runCommand("plan", runPlan);
  });

program
  .command("retro [step]")
  .description("Post-approve retro — lessons → retro/lessons.json")
  .action(async (step?: string) => {
    await runCommand("retro", (ctx) => runRetro(ctx, step));
  });

program
  .command("brainstorm")
  .description("Auto init (if needed) + team delegate; optional topic as extra args")
  .alias("bs")
  .option("--project <name>", "Project name when auto-init")
  .option("--sync", "Wait and run team sync")
  .option("--wait <seconds>", "Seconds before sync when --sync", "30")
  .option("--launch", "Pass through to dispatch")
  .option("--headless", "Pass through to dispatch")
  .option("--trust", "Pass through to dispatch")
  .option("--dry-run", "Pass through to dispatch")
  .option("--force-run", "Pass through to dispatch")
  .option("--max-retries <n>", "Pass through to dispatch")
  .option("--role <name>", "Pass through to dispatch")
  .allowExcessArguments(true)
  .action(async function (this: Command) {
    const o = this.opts() as Record<string, string | boolean | undefined>;
    const tail = this.args as string[];
    const waitRaw = typeof o.wait === "string" ? o.wait : "30";
    const waitSeconds = Number(waitRaw);
    await runCommand("brainstorm", (ctx) =>
      runBrainstorm(ctx, {
        project: typeof o.project === "string" ? o.project : undefined,
        sync: o.sync === true,
        waitSeconds: Number.isFinite(waitSeconds) ? waitSeconds : 30,
        topic: tail.length ? tail.join(" ") : undefined,
        dispatch: {
          launch: o.launch === true,
          headless: o.headless === true,
          trust: o.trust === true,
          dryRun: o.dryRun === true,
          forceRun: o.forceRun === true,
          maxRetries: typeof o.maxRetries === "string" ? o.maxRetries : undefined,
          role: typeof o.role === "string" ? o.role : undefined,
        },
      }),
    );
  });

program
  .command("summary")
  .description("Tóm tắt step hiện tại")
  .alias("sum")
  .action(async () => {
    await runCommand("summary", runSummary);
  });

program
  .command("history")
  .description("Lịch sử approvals")
  .alias("h")
  .action(async () => {
    await runCommand("history", runHistory);
  });

program
  .command("release-dashboard")
  .description("PM release summary markdown")
  .alias("dashboard")
  .option("--step <n>", "Step number")
  .option("--no-write", "Print only, do not write file")
  .action(async (opts: { step?: string; noWrite?: boolean }) => {
    await runCommand("release-dashboard", (ctx) =>
      runReleaseDashboard(ctx, {
        step: opts.step !== undefined ? Number(opts.step) : undefined,
        noWrite: opts.noWrite === true,
      }),
    );
  });

program
  .command("reset <step>")
  .description("Reset workflow về step (interactive)")
  .option("-y, --yes", "Skip confirmation")
  .action(async (step: string, opts: { yes?: boolean }) => {
    await runCommand("reset", (ctx) => runReset(ctx, step, { yes: opts.yes }));
  });

program
  .command("init")
  .description("Khởi tạo project (partial TS — MCP merge Phase 4 nếu FLOWCTL_ENGINE=ts)")
  .option("--project <name>", "Tên dự án")
  .option("--overwrite", "Ghi đè scaffold / reset active flow state")
  .option("--no-setup", "Bỏ qua setup.sh")
  .action(async (opts: { project?: string; overwrite?: boolean; noSetup?: boolean }) => {
    try {
      const ctx = await getContext();
      await runInit(ctx, {
        project: opts.project,
        overwrite: opts.overwrite === true,
        noSetup: opts.noSetup === true,
      });
      invalidateContextCache();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exitCode = 1;
    }
  });

program
  .command("fork")
  .description("Fork isolated flow (eval \"$(flowctl fork)\")")
  .option("-l, --label <text>", "Fork label")
  .option("--project <name>", "Project name")
  .action(async (opts: { label?: string; project?: string }) => {
    try {
      const ctx = await getContext();
      await runFork(ctx, { label: opts.label, project: opts.project });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
