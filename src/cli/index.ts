#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, type FlowctlContext } from "@/cli/context";
import { runAssess } from "@/commands/assess";
import { runApprove } from "@/commands/approve";
import { runBlockerAdd, runBlockerResolve } from "@/commands/blocker";
import { runDecision } from "@/commands/decision";
import { runGateCheck } from "@/commands/gate";
import { runReject } from "@/commands/reject";
import { runSkip } from "@/commands/skip";
import { runStart } from "@/commands/start";
import { runStatus } from "@/commands/status";
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

let ctxPromise: Promise<FlowctlContext> | null = null;
const lockReleases = new Map<string, () => Promise<void>>();

async function getContext(): Promise<FlowctlContext> {
  if (!ctxPromise) {
    ctxPromise = createContext(process.cwd(), process.env);
  }
  return ctxPromise;
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

await program.parseAsync(process.argv);
