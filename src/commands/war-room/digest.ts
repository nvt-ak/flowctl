import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FlowctlState } from "@/state/schema";
import { buildContextSnapshot } from "@/integrations/context-snapshot";
import { pathExists } from "@/utils/fs";

export async function warRoomOutputsFresh(
  wrDir: string,
  stateFile: string,
): Promise<boolean> {
  const pm = join(wrDir, "pm-analysis.md");
  const tl = join(wrDir, "tech-lead-assessment.md");
  const outs: string[] = [];
  if (await pathExists(pm)) outs.push(pm);
  if (await pathExists(tl)) outs.push(tl);
  if (outs.length === 0) return false;

  const stateStat = await import("node:fs/promises").then((fs) =>
    fs.stat(stateFile),
  );
  let wrTs = 0;
  for (const p of outs) {
    const st = await import("node:fs/promises").then((fs) => fs.stat(p));
    wrTs = Math.max(wrTs, st.mtimeMs);
  }
  return wrTs > stateStat.mtimeMs;
}

export async function generateContextDigest(opts: {
  state: FlowctlState;
  stateFile: string;
  step: string;
  stepName: string;
  wrDir: string;
  repoRoot: string;
  dispatchBase: string;
  mode?: "full" | "simple";
}): Promise<string> {
  const mode = opts.mode ?? "full";
  const digestPath = join(opts.dispatchBase, `step-${opts.step}`, "context-digest.md");

  let pmAnalysis = "";
  let tlAssessment = "";
  if (mode === "full") {
    const pmFile = join(opts.wrDir, "pm-analysis.md");
    const tlFile = join(opts.wrDir, "tech-lead-assessment.md");
    if (await pathExists(pmFile)) pmAnalysis = await readFile(pmFile, "utf-8");
    if (await pathExists(tlFile)) tlAssessment = await readFile(tlFile, "utf-8");
  }

  const snap = await buildContextSnapshot({
    state: opts.state,
    step: opts.step,
    repoRoot: opts.repoRoot,
    dispatchBase: opts.dispatchBase,
  });

  const priorDecisions: string[] = [];
  const openBlockers: string[] = [];
  for (const [n, s] of Object.entries(opts.state.steps)) {
    if (Number(n) < Number(opts.step)) {
      for (const d of s.decisions ?? []) {
        if (d.type !== "rejection") {
          priorDecisions.push(`- Step ${n}: ${d.description}`);
        }
      }
      for (const b of s.blockers ?? []) {
        if (!b.resolved) {
          openBlockers.push(`- Step ${n}: ${b.description}`);
        }
      }
    }
  }

  const generated = new Date().toISOString().slice(0, 19).replace("T", " ");
  let digest = `# Context Digest — Step ${opts.step}: ${opts.stepName}
Generated: ${generated} | Mode: ${mode}

---

## 🔍 Context Snapshot (compile-once)

${snap}

### When live data is needed
\`\`\`
wf_step_context()    ← state + decisions + blockers (~300 tokens)
wf_state()           ← step/status only
\`\`\`
> Graphify / query_graph only for code structure (steps 4–8).

---

## 📋 Prior Decisions (last 10)
${priorDecisions.slice(-10).join("\n") || "- No decisions from previous steps"}

## 🚧 Open Blockers
${openBlockers.join("\n") || "- No open blockers"}

`;

  if (pmAnalysis) {
    digest += `## 🎯 PM Analysis (War Room output)
${pmAnalysis}

`;
  }
  if (tlAssessment) {
    digest += `## ⚙️ TechLead Assessment (War Room Output)
${tlAssessment}

`;
  }

  digest += `---
## 📌 How to Use This Digest
- **Layer 1**: Read snapshot above; call \`wf_step_context()\` only if state changed after digest was created
- **Layer 2**: GitNexus **CLI** + \`graphify-out/GRAPH_REPORT.md\` for code work (steps 4–8)
- **Layer 3**: \`query_graph(...)\` for code structure (if graph MCP enabled)
- **Layer 4**: Sections below / kickoff file when 1–3 are insufficient
- **Never** re-read entire prior step reports
`;

  await writeFile(digestPath, digest, "utf-8");
  return relative(opts.repoRoot, digestPath);
}

export async function invalidateWarRoomDigest(
  dispatchBase: string,
  step: string,
): Promise<void> {
  const digest = join(dispatchBase, `step-${step}`, "context-digest.md");
  if (await pathExists(digest)) {
    await import("node:fs/promises").then((fs) => fs.unlink(digest));
  }
}
