import chalk from "chalk";
import { readRegistry } from "@/config/registry";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import type { FlowctlState } from "@/state/schema";
import { pathExists } from "@/utils/fs";
import { getStep } from "@/workflow/step-utils";

const STATUS_ICONS: Record<string, string> = {
  completed: chalk.green("✓"),
  in_progress: chalk.yellow("→"),
  approved: chalk.green("✓"),
  pending: chalk.gray("○"),
  rejected: chalk.red("✗"),
  skipped: chalk.gray("⊘"),
};

export async function runStatusAll(ctx: FlowctlContext): Promise<void> {
  const registryFile = ctx.paths.registryFile;
  if (!(await pathExists(registryFile))) {
    console.log(chalk.yellow("Registry not found (~/.flowctl/registry.json)."));
    return;
  }
  const registry = await readRegistry(registryFile);
  const projects = Object.values(registry.projects).sort(
    (a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""),
  );
  if (projects.length === 0) {
    console.log("  (no projects registered)");
    return;
  }
  console.log(chalk.blue.bold("\n   All Projects — flowctl registry\n"));
  const now = Date.now();
  for (const p of projects) {
    const last = Date.parse(p.last_seen);
    const ageSec = Number.isFinite(last)
      ? Math.floor((now - last) / 1000)
      : 999_999;
    const ageStr =
      ageSec < 60
        ? `${ageSec}s ago`
        : ageSec < 3600
          ? `${Math.floor(ageSec / 60)}m ago`
          : `${Math.floor(ageSec / 3600)}h ago`;
    const dot =
      ageSec < 600 ? chalk.green("●") : ageSec < 3600 ? chalk.yellow("○") : chalk.gray("·");
    const blk = p.open_blockers
      ? chalk.red(`  ⚠ ${p.open_blockers} blocker(s)`)
      : "";
    console.log(
      `  ${dot} ${chalk.bold((p.project_name ?? "?").padEnd(28))}Step ${p.current_step ?? 0}/9  ${(p.overall_status ?? "?").padEnd(14)}${ageStr}${blk}`,
    );
    console.log(chalk.gray(`    ${p.path ?? "?"}\n`));
  }
}

function formatStatusOutput(state: FlowctlState): string {
  const lines: string[] = [];
  const current = Number(state.current_step);
  const steps = state.steps;
  const activeTotal = Object.values(steps).filter((s) => s.status !== "skipped").length;
  let activeIdx = 0;

  for (let n = 1; n <= 9; n++) {
    const s = getStep(state, n);
    if (!s) continue;
    const name = s.name ?? "";
    const status = s.status ?? "pending";
    const agent = s.agent ?? "";
    const icon = STATUS_ICONS[status] ?? "○";

    if (status === "skipped") {
      const reason = s.skip_reason ? ` — ${s.skip_reason}` : "";
      lines.push(chalk.gray(`  ⊘ [SKIP] ${name}${reason}`));
      continue;
    }

    activeIdx += 1;
    const prefix = n === current ? chalk.bold("→ ") : "  ";
    const approval = s.approval_status
      ? ` [${s.approval_status.toUpperCase()}]`
      : "";
    lines.push(
      `${prefix}${icon} Step ${activeIdx}/${activeTotal}: ${name} (@${agent})${approval}`,
    );
  }

  const blockers = getStep(state, current)?.blockers ?? [];
  const open = blockers.filter((b) => !b.resolved);
  if (open.length > 0) {
    lines.push("");
    lines.push(chalk.red(`  Blockers (${open.length}):`));
    open.forEach((b, i) => {
      lines.push(`    [${i}] ${b.description ?? ""}`);
    });
  }

  return lines.join("\n");
}

export async function runStatus(
  ctx: FlowctlContext,
  opts: { all?: boolean },
): Promise<void> {
  if (opts.all) {
    await runStatusAll(ctx);
    return;
  }

  const stateFile = requireStateFile(ctx);
  const result = await readState(stateFile);
  if (!result.ok) {
    throw new Error(result.error);
  }
  const state = result.data;

  console.log(chalk.blue.bold("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.blue.bold("   Workflow Status"));
  console.log(chalk.blue.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  if (state.project_name) {
    console.log(`  Project: ${chalk.bold(state.project_name)}`);
  }
  console.log(`  Status:  ${chalk.yellow(state.overall_status)}`);
  console.log("");
  console.log(formatStatusOutput(state));
  console.log(`\n  Use ${chalk.cyan("flowctl approve")} after step completes\n`);
}
