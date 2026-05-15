import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FlowctlState } from "@/state/schema";
import { buildContextSnapshot } from "@/integrations/context-snapshot";
import { pathExists } from "@/utils/fs";

export type BriefGenOpts = {
  state: FlowctlState;
  step: string;
  repoRoot: string;
  dispatchDir: string;
  reportsDir: string;
  dispatchBase: string;
  roles: string[];
};

export async function writeContextSnapshotFile(
  opts: BriefGenOpts,
): Promise<string> {
  const snap = await buildContextSnapshot({
    state: opts.state,
    step: opts.step,
    repoRoot: opts.repoRoot,
    dispatchBase: opts.dispatchBase,
  });
  const snapFile = join(opts.dispatchDir, "context-snapshot.md");
  await mkdir(opts.dispatchDir, { recursive: true });
  await writeFile(snapFile, snap, "utf-8");
  return relative(opts.repoRoot, snapFile);
}

export async function generateRoleBriefs(opts: BriefGenOpts): Promise<void> {
  const step = opts.step;
  const s = opts.state.steps[step];
  if (!s) {
    throw new Error(`ERROR|brief_generation|missing step ${step} in state`);
  }
  const stepName = s.name ?? "";
  const snapRel = await writeContextSnapshotFile(opts);
  const isCodeStep = ["4", "5", "6", "7", "8"].includes(step);

  const kickoffDir = join(opts.repoRoot, "workflows", "steps");
  let kickoffRel = "";
  if (await pathExists(kickoffDir)) {
    const padded = String(Number(step)).padStart(2, "0");
    const entries = await readdir(kickoffDir);
    const match = entries.find((f) => f.startsWith(`${padded}-`));
    if (match) kickoffRel = relative(opts.repoRoot, join(kickoffDir, match));
  }

  const plansDir = join(opts.repoRoot, "plans");
  let latestPlan = "";
  if (await pathExists(plansDir)) {
    const dirs = (await readdir(plansDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    if (dirs.length > 0) {
      latestPlan = relative(opts.repoRoot, join(plansDir, dirs.at(-1)!, "plan.md"));
    }
  }

  const digestPath = join(opts.dispatchDir, "context-digest.md");
  const digestRel = (await pathExists(digestPath))
    ? relative(opts.repoRoot, digestPath)
    : "";

  const mercDir = join(opts.dispatchDir, "mercenaries");
  let mercOutputs: string[] = [];
  if (await pathExists(mercDir)) {
    const files = await readdir(mercDir);
    mercOutputs = files
      .filter((f) => f.endsWith("-output.md"))
      .sort()
      .map((f) => relative(opts.repoRoot, join(mercDir, f)));
  }

  for (const role of opts.roles) {
    const reportPath = join(opts.reportsDir, `${role}-report.md`);
    const reportRel = relative(opts.repoRoot, reportPath);

    let brief = `# Worker Brief — @${role} — Step ${step}: ${stepName}

## Context (compile-once)

Read **\`@${snapRel}\`** — Context Snapshot (FRESH/STALE indicator inside). Do **not** call \`wf_step_context()\` when snapshot is **FRESH** unless you edited workflow state.

### Layer 1 — Workflow
\`\`\`
wf_step_context()    ← state + decisions + blockers
wf_state()           ← step/status only
\`\`\`

### Layer 2 — GitNexus + graph (code steps 4-8)
`;
    if (isCodeStep) {
      brief += `\`\`\`
# GitNexus CLI; code structure: cat graphify-out/GRAPH_REPORT.md
\`\`\`
`;
    } else {
      brief += "*(Skip — non-code step)*\n";
    }

    brief += `
### Layer 3 — Code graph (steps 4-8)
\`\`\`
query_graph("component or flow")   ← if graph MCP enabled
\`\`\`

### Layer 4 — File reads
`;
    if (digestRel) brief += `- @${digestRel}\n`;
    if (kickoffRel) brief += `- @${kickoffRel}\n`;
    if (latestPlan) brief += `- @${latestPlan}\n`;
    if (mercOutputs.length > 0) {
      brief += "\n### Mercenary Outputs\n";
      for (const mo of mercOutputs) brief += `- @${mo}\n`;
    }

    brief += `
---

## Task @${role}

**Skills:** Load only \`skills-to-load.compact\` from \`.cursor/agents/${role}-agent.md\`.

1. Read Context Snapshot; \`wf_step_context()\` only if state is newer than snapshot
2. Execute scope @${role} for step ${step}
3. Important decisions → DECISION in report
4. Block → NEEDS_SPECIALIST / BLOCKER (do not stop flowctl)
5. Write report with EVIDENCE

## Report output — REQUIRED

\`${reportPath}\`

(relative: \`${reportRel}\`)

**Rules:** DO NOT \`flowctl approve\`; DO NOT advance step.
`;
    await writeFile(join(opts.dispatchDir, `${role}-brief.md`), brief, "utf-8");
  }
}
