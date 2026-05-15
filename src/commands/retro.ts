import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import type { FlowctlState } from "@/state/schema";
import { pathExists } from "@/utils/fs";
import { getStepName } from "@/workflow/step-utils";

type LessonsFile = {
  patterns: string[];
  steps: Record<string, RetroPayload>;
};

type RetroPayload = {
  step: string;
  step_name: string;
  timestamp: string;
  n_decisions: number;
  blocker_counts: Record<string, number>;
  blocker_types: string[];
  mercenaries_used: string[];
  patterns: string[];
};

function buildRetroPayload(
  state: FlowctlState,
  step: number,
  stepName: string,
): RetroPayload {
  const stepKey = String(step);
  const stepObj = state.steps[stepKey] ?? { blockers: [], decisions: [] };
  const blockerCounts: Record<string, number> = {};
  const blockersByType: string[] = [];

  for (const b of stepObj.blockers ?? []) {
    const src = b.source ?? "unknown";
    const role = src.split("/").pop()?.replace("-report.md", "") ?? "unknown";
    blockerCounts[role] = (blockerCounts[role] ?? 0) + 1;
    const desc = (b.description ?? "").toLowerCase();
    const pattern =
      ["api", "db", "schema", "code", "build"].some((w) => desc.includes(w))
        ? "technical"
        : "scope";
    const blockerType = b.resolved ? "resolved" : "unresolved";
    blockersByType.push(`${blockerType}:${pattern}:${role}`);
  }

  const nDecisions = (stepObj.decisions ?? []).filter(
    (d) => d.type !== "rejection",
  ).length;

  return {
    step: stepKey,
    step_name: stepName,
    timestamp: new Date().toISOString(),
    n_decisions: nDecisions,
    blocker_counts: blockerCounts,
    blocker_types: [...new Set(blockersByType.map((b) => b.split(":")[1] ?? ""))].filter(
      Boolean,
    ),
    mercenaries_used: [],
    patterns: [],
  };
}

/** Port of cmd_retro — lessons → retroDir/lessons.json */
export async function runRetro(
  ctx: FlowctlContext,
  stepArg?: string,
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  let step = stepArg ? Number(stepArg) : Number(read.data.current_step);
  if (!stepArg) {
    const prev = step - 1;
    if (prev >= 1) step = prev;
  }

  const stepName = getStepName(read.data, step);
  const mercDir = join(ctx.paths.dispatchBase, `step-${step}`, "mercenaries");
  const lessonsFile = join(ctx.paths.retroDir, "lessons.json");

  const retro = buildRetroPayload(read.data, step, stepName);

  const mercsUsed: string[] = [];
  if (await pathExists(mercDir)) {
    const names = await readdir(mercDir);
    for (const f of names) {
      if (f.endsWith("-output.md")) {
        const stem = f.replace(/-output\.md$/, "");
        const mtype = stem.split("-")[0] ?? "unknown";
        mercsUsed.push(mtype);
      }
    }
  }
  retro.mercenaries_used = [...new Set(mercsUsed)];

  const patterns: string[] = [];
  for (const [role, count] of Object.entries(retro.blocker_counts)) {
    patterns.push(`Step ${step}: @${role} had ${count} blocker(s)`);
  }
  if (retro.mercenaries_used.length) {
    patterns.push(
      `Step ${step}: mercenaries used: ${[...new Set(retro.mercenaries_used)].join(", ")}`,
    );
  }
  if (retro.n_decisions > 5) {
    patterns.push(
      `Step ${step}: high decision count (${retro.n_decisions}) — consider splitting`,
    );
  }
  retro.patterns = patterns;

  let existing: LessonsFile = { patterns: [], steps: {} };
  if (await pathExists(lessonsFile)) {
    try {
      existing = JSON.parse(await readFile(lessonsFile, "utf-8")) as LessonsFile;
    } catch {
      existing = { patterns: [], steps: {} };
    }
  }
  const mergedPatterns = [...(existing.patterns ?? []), ...patterns].slice(-20);
  existing.patterns = mergedPatterns;
  existing.steps[String(step)] = retro;

  await mkdir(ctx.paths.retroDir, { recursive: true });
  await writeFile(lessonsFile, JSON.stringify(existing, null, 2), "utf-8");

  console.log(
    chalk.cyan.bold(`\n🔄 RETRO — Step ${step}: ${stepName}\n`),
  );
  console.log(`  Step ${retro.step}: ${retro.step_name}`);
  console.log(`  Decisions made   : ${retro.n_decisions}`);
  const bc = retro.blocker_counts;
  if (Object.keys(bc).length) {
    const roles = Object.entries(bc)
      .map(([r, c]) => `@${r}(${c})`)
      .join(", ");
    console.log(`  Blockers by role : ${roles}`);
  } else {
    console.log("  Blockers         : none");
  }
  if (retro.mercenaries_used.length) {
    console.log(`  Mercenaries used : ${retro.mercenaries_used.join(", ")}`);
  }
  if (patterns.length) {
    console.log("");
    console.log("  Patterns detected:");
    for (const p of patterns) {
      console.log(`    - ${p}`);
    }
  }
  const rel = lessonsFile.replace(ctx.projectRoot + "/", "");
  console.log("");
  console.log(chalk.green(`✓ Lessons saved: ${chalk.cyan(rel)}`));
  console.log("");
}
