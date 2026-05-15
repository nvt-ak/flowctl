import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import {
  complexityScore,
  complexityTier,
  warRoomThreshold,
} from "@/scoring/complexity";
import { pathExists } from "@/utils/fs";
import { requireCurrentStep } from "@/workflow/step-utils";

const execFileAsync = promisify(execFile);

async function printGraphifyHint(repoRoot: string): Promise<void> {
  const gpath = join(repoRoot, "graphify-out", "graph.json");
  if (!(await pathExists(gpath))) {
    console.log(
      "  [hint/graphify] graphify-out/graph.json not found — skip or run graphify index",
    );
    return;
  }
  try {
    const raw = JSON.parse(await readFile(gpath, "utf-8")) as {
      nodes?: Record<string, unknown> | unknown[];
      communities?: unknown[];
      clusters?: unknown[];
    };
    const nodes = raw.nodes;
    const n = Array.isArray(nodes)
      ? nodes.length
      : nodes && typeof nodes === "object"
        ? Object.keys(nodes).length
        : 0;
    const communities = raw.communities ?? raw.clusters ?? [];
    const c = Array.isArray(communities) ? communities.length : 0;
    console.log(
      `  [hint/graphify] ~${n} nodes — communities/clusters ~${c} (read-only; use for scope — set --impacted-modules if PM agrees)`,
    );
  } catch (e) {
    console.log(
      `  [hint/graphify] Could not read graph.json: ${e instanceof Error ? e.message : e}`,
    );
  }
}

async function printGitHint(repoRoot: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoRoot, "diff", "--name-only", "HEAD"],
      { encoding: "utf-8" },
    );
    const roots = new Set<string>();
    for (const line of stdout.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("dev/null")) continue;
      roots.add(t.split("/")[0] ?? t);
    }
    console.log(
      `  [hint/git] ~${roots.size} top-level roots in changed paths vs HEAD (read-only; PM sets --impacted-modules)`,
    );
  } catch {
    // not a git repo — skip
  }
}

export async function runComplexity(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));
  const score = complexityScore(read.data, step);
  const tier = complexityTier(score);
  const thr = warRoomThreshold(read.data, process.env.WF_WAR_ROOM_THRESHOLD);

  let verdict: string;
  let color: (s: string) => string = chalk.green;
  if (tier === "MICRO") {
    verdict = "1 agent, light ceremony → PM assign directly";
  } else if (tier === "STANDARD") {
    color = chalk.yellow;
    verdict = `Score 2–3: brief + report; War Room when score ≥ ${thr} (default)`;
  } else {
    color = chalk.red;
    verdict = `Score 4–5: War Room (PM + TechLead) BEFORE dispatching full team (threshold ${thr})`;
  }

  console.log(chalk.bold(`\nComplexity Score — Step ${step}`));
  console.log(`  Score : ${color(chalk.bold(`${score} / 5`))} (${tier})`);
  console.log(`  Tier  : ${color(chalk.bold(tier))}`);
  console.log(
    `  War Room threshold: ${chalk.bold(String(thr))} (settings.war_room_threshold or WF_WAR_ROOM_THRESHOLD)`,
  );
  console.log(`  Action: ${verdict}\n`);

  console.log(chalk.bold("Hybrid hints (read-only, no state writes):"));
  await printGraphifyHint(ctx.projectRoot);
  await printGitHint(ctx.projectRoot);
  console.log("");
}
