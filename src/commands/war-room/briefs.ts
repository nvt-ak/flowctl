import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FlowctlState } from "@/state/schema";
import { buildContextSnapshot } from "@/integrations/context-snapshot";
import { pathExists } from "@/utils/fs";

async function priorDecisionsText(state: FlowctlState, step: number): Promise<string> {
  const lines: string[] = [];
  for (let n = 1; n < step; n++) {
    const s = state.steps[String(n)];
    for (const d of s?.decisions ?? []) {
      if (d.type !== "rejection") {
        lines.push(`- Step ${n}: ${d.description}`);
      }
    }
  }
  return lines.slice(-10).join("\n") || "- Chưa có decisions từ các steps trước";
}

async function lessonsText(retroDir: string): Promise<string> {
  const lessonsFile = join(retroDir, "lessons.json");
  if (!(await pathExists(lessonsFile))) return "- Chưa có retro data";
  try {
    const d = JSON.parse(await readFile(lessonsFile, "utf-8")) as {
      patterns?: string[];
    };
    const items = (d.patterns ?? []).slice(-5);
    return items.map((i) => `- ${i}`).join("\n") || "- Chưa có retro data";
  } catch {
    return "- Chưa có retro data";
  }
}

export async function generateWarRoomBriefs(opts: {
  state: FlowctlState;
  step: string;
  stepName: string;
  wrDir: string;
  repoRoot: string;
  dispatchBase: string;
  retroDir: string;
}): Promise<void> {
  await mkdir(opts.wrDir, { recursive: true });
  const snap = await buildContextSnapshot({
    state: opts.state,
    step: opts.step,
    repoRoot: opts.repoRoot,
    dispatchBase: opts.dispatchBase,
  });
  const snapFile = join(opts.wrDir, "context-snapshot.md");
  await writeFile(snapFile, snap, "utf-8");
  const snapRel = relative(opts.repoRoot, snapFile);
  const prior = await priorDecisionsText(opts.state, Number(opts.step));
  const lessons = await lessonsText(opts.retroDir);
  const wrRel = relative(opts.repoRoot, opts.wrDir);

  const pmBrief = `# War Room Brief — @pm — Phân tích scope Step ${opts.step}: ${opts.stepName}

## Nhiệm vụ
Bạn là PM Agent. War Room phase — phân tích scope TRƯỚC khi dispatch team.

## Context (compile-once)
Read **\`@${snapRel}\`** — Context Snapshot. Skip \`wf_step_context()\` when **FRESH**.

## Prior Decisions
${prior}

## Lessons Learned
${lessons}

## Output
Ghi vào: ${wrRel}/pm-analysis.md
`;

  const tlBrief = `# War Room Brief — @tech-lead — Technical Assessment Step ${opts.step}: ${opts.stepName}

## Nhiệm vụ
Bạn là Tech Lead. War Room phase — đánh giá feasibility TRƯỚC khi dispatch team.

## Context
Read **\`@${snapRel}\`**

## Prior Decisions
${prior}

## Output
Ghi vào: ${wrRel}/tech-lead-assessment.md
`;

  await writeFile(join(opts.wrDir, "pm-analysis-brief.md"), pmBrief, "utf-8");
  await writeFile(
    join(opts.wrDir, "tech-lead-assessment-brief.md"),
    tlBrief,
    "utf-8",
  );
}

export function printWarRoomSpawnBoard(
  wrDir: string,
  repoRoot: string,
): void {
  const rel = wrDir.replace(repoRoot + "/", "");
  console.log("\n▶ WAR ROOM SPAWN BOARD — Spawn 2 agents SONG SONG:\n");
  console.log(`  [Tab 1] @pm — Brief: ${rel}/pm-analysis-brief.md`);
  console.log(`  [Tab 2] @tech-lead — Brief: ${rel}/tech-lead-assessment-brief.md`);
  console.log(
    "\n  Orchestration: Prefer Mode B (Task subagents) for isolated context.\n",
  );
}
