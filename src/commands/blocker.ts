import chalk from "chalk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { loadRolePolicy } from "@/commands/dispatch/policy";
import { readState } from "@/state/reader";
import { FlowctlStateSchema } from "@/state/schema";
import { appendPath } from "@/state/writer";
import { atomicJsonWrite } from "@/utils/json";
import { nowTimestamp } from "@/utils/time";
import { requireCurrentStep } from "@/workflow/step-utils";

function allBacktickPathsExist(desc: string, repoRoot: string): boolean {
  const paths = [...(desc || "").matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
  if (paths.length === 0) return false;
  return paths.every((p) => existsSync(join(repoRoot, p)));
}

/** Mirrors `cmd_reconcile_blockers` in scripts/flowctl.sh. */
function resolveRuleMatched(
  desc: string,
  repoRoot: string,
  rolesCfg: Record<string, unknown>,
): [boolean, string] {
  const text = (desc || "").toLowerCase();

  if (text.includes("role-policy.v1.json")) {
    if ("backend" in rolesCfg && "frontend" in rolesCfg) {
      return [true, "role-policy covers backend/frontend"];
    }
    return [false, "role-policy missing backend/frontend"];
  }

  if (text.includes("docs/requirements.md") && text.includes("docs/architecture.md")) {
    const reqOk = existsSync(join(repoRoot, "docs/requirements.md"));
    const archOk = existsSync(join(repoRoot, "docs/architecture.md"));
    if (reqOk && archOk) {
      return [true, "requirements + architecture docs exist"];
    }
    const missing: string[] = [];
    if (!reqOk) missing.push("docs/requirements.md");
    if (!archOk) missing.push("docs/architecture.md");
    return [false, `missing: ${missing.join(", ")}`];
  }

  if (allBacktickPathsExist(desc, repoRoot)) {
    return [true, "all referenced backtick paths exist"];
  }

  return [false, "no reconcile rule matched"];
}

export async function runBlockerReconcile(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = String(requireCurrentStep(read.data));
  const repoRoot = ctx.projectRoot;
  const policy = await loadRolePolicy(ctx.paths.rolePolicyFile);
  const rolesCfg = policy.roles ?? {};
  const now = nowTimestamp();

  const resolvedOut: { id: string; reason: string }[] = [];
  const openOut: { id: string; reason: string }[] = [];

  await atomicJsonWrite(
    stateFile,
    (current) => {
      const stepKey = step;
      const blockers = [...(current.steps[stepKey]?.blockers ?? [])];
      for (let i = 0; i < blockers.length; i++) {
        const b = blockers[i]!;
        if (b.resolved) continue;
        const [ok, reason] = resolveRuleMatched(
          b.description,
          repoRoot,
          rolesCfg as Record<string, unknown>,
        );
        if (ok) {
          blockers[i] = {
            ...b,
            resolved: true,
            resolved_at: now,
            resolved_by: "reconcile",
            resolution_note: reason,
          };
          resolvedOut.push({ id: b.id, reason });
        } else {
          openOut.push({ id: b.id, reason });
        }
      }
      return {
        ...current,
        steps: {
          ...current.steps,
          [stepKey]: {
            ...current.steps[stepKey]!,
            blockers,
          },
        },
        updated_at: now,
      };
    },
    FlowctlStateSchema,
  );

  console.log(
    `RECONCILE_OK|step=${step}|resolved=${resolvedOut.length}|remaining_open=${openOut.length}`,
  );
  for (const { id, reason } of resolvedOut) {
    console.log(`RESOLVED|${id}|${reason}`);
  }
  for (const { id, reason } of openOut) {
    console.log(`OPEN|${id}|${reason}`);
  }
}

export async function runBlockerAdd(
  ctx: FlowctlContext,
  description: string,
): Promise<void> {
  if (!description.trim()) {
    throw new Error("Blocker description is required");
  }
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);
  const id = `B${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;

  await appendPath(stateFile, `steps.${step}.blockers`, {
    id,
    description,
    created_at: nowTimestamp(),
    resolved: false,
  });

  await atomicJsonWrite(
    stateFile,
    (current) => {
      const m = current.metrics ?? {
        total_blockers: 0,
        total_decisions: 0,
        steps_completed: 0,
        on_schedule: true,
      };
      return {
        ...current,
        metrics: {
          total_blockers: m.total_blockers + 1,
          total_decisions: m.total_decisions,
          steps_completed: m.steps_completed,
          on_schedule: m.on_schedule,
        },
      };
    },
    FlowctlStateSchema,
  );

  console.log(chalk.yellow(`\nBlocker đã được ghi nhận: [${id}] ${description}`));
  console.log(chalk.bold(`Resolve: flowctl blocker resolve ${id}\n`));
}

export async function runBlockerResolve(
  ctx: FlowctlContext,
  blockerId: string,
): Promise<void> {
  if (!blockerId.trim()) {
    throw new Error("Thiếu blocker id.");
  }
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const step = requireCurrentStep(read.data);

  await atomicJsonWrite(
    stateFile,
    (current) => {
      const stepKey = String(step);
      const blockers = [...(current.steps[stepKey]?.blockers ?? [])];
      const idx = blockers.findIndex((b) => b.id === blockerId);
      if (idx >= 0) {
        blockers[idx] = {
          ...blockers[idx]!,
          resolved: true,
          resolved_at: nowTimestamp(),
        };
      }
      return {
        ...current,
        steps: {
          ...current.steps,
          [stepKey]: {
            ...current.steps[stepKey]!,
            blockers,
          },
        },
        updated_at: nowTimestamp(),
      };
    },
    FlowctlStateSchema,
  );

  console.log(chalk.green(`Blocker ${blockerId} đã được resolved`));
}
