import chalk from "chalk";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { ensureDataDirs } from "@/config/paths";
import { readState } from "@/state/reader";
import { setPath } from "@/state/writer";
import { checkIdempotency } from "@/utils/lock";
import { requireCurrentStep } from "@/workflow/step-utils";
import { generateRoleBriefs } from "@/commands/dispatch/brief";
import {
  loadRolePolicy,
  PolicyViolationError,
  validateDispatchPolicy,
  validateMaxRetries,
  type DispatchMode,
} from "@/commands/dispatch/policy";
import { collectStepRoles } from "@/commands/dispatch/roles";

export type DispatchOptions = {
  launch?: boolean;
  headless?: boolean;
  trust?: boolean;
  dryRun?: boolean;
  forceRun?: boolean;
  maxRetries?: string;
  role?: string;
};

function resolveMode(opts: DispatchOptions): DispatchMode {
  if (opts.launch && opts.headless) {
    throw new Error("Cannot use both --launch and --headless.");
  }
  if (opts.headless) return "headless";
  if (opts.launch) return "launch";
  return "manual";
}

async function ensureFlowId(
  stateFile: string,
  read: Awaited<ReturnType<typeof readState>>,
): Promise<string> {
  if (!read.ok) throw new Error(read.error);
  let flowId = (read.data.flow_id ?? "").trim();
  if (!flowId) {
    flowId = `wf-${randomUUID()}`;
    await setPath(stateFile, "flow_id", flowId);
  }
  return flowId;
}

export async function runDispatch(
  ctx: FlowctlContext,
  opts: DispatchOptions = {},
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));
  const mode = resolveMode(opts);
  const maxRetriesRaw = opts.maxRetries ?? "3";
  validateMaxRetries(maxRetriesRaw);
  const maxRetries = Number.parseInt(maxRetriesRaw, 10);

  let roles = collectStepRoles(read.data, step);
  if (roles.length === 0) {
    throw new Error(
      "ERROR|brief_generation|step has no agents assigned — check flowctl-state.json",
    );
  }

  const roleFilter = (opts.role ?? "").replace(/^@/, "").trim();
  if (roleFilter) {
    roles = roles.filter((r) => r === roleFilter);
    if (roles.length === 0) {
      throw new Error(`No role '${roleFilter}' on step ${step}`);
    }
  }

  const policy = await loadRolePolicy(ctx.paths.rolePolicyFile);
  try {
    validateDispatchPolicy(roles, policy, {
      mode,
      trustRequested: opts.trust === true,
    });
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      console.error(chalk.red(err.message));
      process.exitCode = 2;
      return;
    }
    throw err;
  }

  await ensureDataDirs(ctx.paths);
  const dispatchDir = join(ctx.paths.dispatchBase, `step-${step}`);
  const reportsDir = join(dispatchDir, "reports");
  await mkdir(dispatchDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await mkdir(ctx.paths.runtimeDir, { recursive: true });

  await generateRoleBriefs({
    state: read.data,
    step,
    repoRoot: ctx.projectRoot,
    dispatchDir,
    reportsDir,
    dispatchBase: ctx.paths.dispatchBase,
    roles,
  });

  const flowId = await ensureFlowId(stateFile, read);
  const runId = `run-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z-${Math.floor(Math.random() * 1e6)}`;

  const relDispatch = dispatchDir.replace(`${ctx.projectRoot}/`, "");
  console.log(
    chalk.green.bold(`\nDispatch bundles created: ${relDispatch}`),
  );
  console.log(`Trace: flow_id=${chalk.bold(flowId)} run_id=${chalk.bold(runId)}`);

  if (mode === "manual" || opts.dryRun) {
    for (const role of roles) {
      console.log(
        chalk.cyan(`  @${role}: ${relDispatch}/${role}-brief.md → reports/${role}-report.md`),
      );
    }
    if (opts.dryRun) {
      console.log(chalk.yellow("\n[dry-run] Briefs only — no workers launched.\n"));
    } else {
      console.log(chalk.yellow("\nManual mode — spawn workers via cursor-dispatch or agent tabs.\n"));
    }
    return;
  }

  // headless / launch: idempotency gate per role (launch defers to bash for worker spawn in hybrid phase)
  for (const role of roles) {
    const key = `${step}:${role}`;
    const { decision, reason } = await checkIdempotency(
      ctx.paths.idempotencyFile,
      key,
      `${flowId}:${runId}:${role}`,
      { forceRun: opts.forceRun, maxRetries },
    );
    if (decision === "SKIP") {
      console.log(chalk.yellow(`[idempotency] skip @${role}: ${reason}`));
      continue;
    }
    if (opts.dryRun) {
      console.log(chalk.cyan(`[dry-run] would launch @${role}`));
      continue;
    }
    console.log(
      chalk.yellow(
        `[dispatch] @${role}: ${decision} — worker launch via bash: FLOWCTL_ENGINE= bash flowctl dispatch --${mode === "headless" ? "headless" : "launch"} --role ${role}`,
      ),
    );
  }
  console.log("");
}
