import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { pathExists } from "@/utils/fs";
import { nowTimestamp } from "@/utils/time";

function planOutputDir(dispatchBase: string, repoRoot: string): string {
  const norm = dispatchBase.replace(/\\/g, "/");
  if (norm.endsWith("/dispatch")) {
    return join(dispatchBase, "..", "plans");
  }
  return join(repoRoot, "workflows", "plans");
}

function statusIcon(status: string): string {
  if (status === "skipped") return "⊘ skipped";
  const map: Record<string, string> = {
    completed: "✅ approved",
    in_progress: "⏳ in progress",
    pending: "⏳ pending",
    rejected: "rejected",
  };
  return map[status] ?? status;
}

/** Regenerate workflows/.../plans/plan.md from state (bash plan.sh / cmd_generate_plan). */
export async function runPlan(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const data = read.data;
  const planDir = planOutputDir(ctx.paths.dispatchBase, ctx.projectRoot);
  await mkdir(planDir, { recursive: true });
  const planFile = join(planDir, "plan.md");
  const notesFile = join(planDir, "plan-notes.md");

  let preserveNotes = "";
  if (await pathExists(notesFile)) {
    preserveNotes = await readFile(notesFile, "utf-8");
  } else if (await pathExists(planFile)) {
    const old = await readFile(planFile, "utf-8");
    const marker = "\n## Notes\n";
    const idx = old.indexOf(marker);
    if (idx !== -1) {
      preserveNotes = old.slice(idx + marker.length).trim();
    }
  }

  const cli = "flowctl";
  const now = nowTimestamp();
  const lines: string[] = [
    `# Project Plan — ${data.project_name}`,
    `_Generated from flowctl state at ${now} — single source of truth_`,
    `_Regenerate: \`${cli} generate-plan\` or \`${cli} plan\`_`,
    "",
    "## Active Steps",
    "| Step | Name | Agent | Status |",
    "|------|------|-------|--------|",
  ];

  for (let n = 1; n <= 9; n++) {
    const s = data.steps[String(n)];
    if (!s) continue;
    const name = s.name ?? "";
    const agent = s.agent ?? "";
    const status = s.status ?? "pending";
    if (status === "skipped") {
      lines.push(`| ~~${n}~~ | ~~${name}~~ | ~~@${agent}~~ | ⊘ skipped |`);
    } else {
      lines.push(`| ${n} | ${name} | @${agent} | ${statusIcon(status)} |`);
    }
  }

  lines.push("", "## Decisions (from state)", "");
  let decisionsAny = false;
  for (let n = 1; n <= 9; n++) {
    for (const d of data.steps[String(n)]?.decisions ?? []) {
      if (d.type !== "rejection") {
        decisionsAny = true;
        const desc = (d.description ?? "").slice(0, 300);
        lines.push(`- Step ${n}: ${desc}`);
      }
    }
  }
  if (!decisionsAny) lines.push("- (none yet)");

  lines.push("", "## Open Blockers", "");
  let blockersAny = false;
  for (const n of Object.keys(data.steps)) {
    const s = data.steps[n];
    if (!s) continue;
    for (const b of s.blockers ?? []) {
      if (!b.resolved) {
        blockersAny = true;
        lines.push(`- Step ${n}: ${(b.description ?? "").slice(0, 200)}`);
      }
    }
  }
  if (!blockersAny) lines.push("- (none)");

  lines.push(
    "",
    "## Progress",
    `Current step: **${data.current_step}** | Overall: **${data.overall_status}**`,
    `Flow ID: \`${data.flow_id}\``,
    "",
    `Status command: \`${cli} status\``,
    "",
  );

  let body = lines.join("\n");
  if (preserveNotes) {
    await writeFile(notesFile, `${preserveNotes}\n`, "utf-8");
    body +=
      "\n## Notes (human-editable — preserved in plan-notes.md)\n\n" +
      preserveNotes +
      "\n";
  }

  await mkdir(dirname(planFile), { recursive: true });
  await writeFile(planFile, body, "utf-8");
  const rel = relative(ctx.projectRoot, planFile);
  console.log(chalk.green(`Plan generated: ${rel || planFile}`));
}
