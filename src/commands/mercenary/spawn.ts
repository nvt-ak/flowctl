import chalk from "chalk";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { getStepName, requireCurrentStep } from "@/workflow/step-utils";
import { readState } from "@/state/reader";
import { scanMercenaryRequests } from "@/commands/mercenary/scan";

export type MercenarySpawnOptions = {
  timeout?: number;
};

export async function runMercenarySpawn(
  ctx: FlowctlContext,
  opts: MercenarySpawnOptions = {},
): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));
  const stepName = getStepName(read.data, Number(step));
  const reportsDir = join(ctx.paths.dispatchBase, `step-${step}`, "reports");
  const requests = await scanMercenaryRequests(reportsDir, ctx.projectRoot);

  if (requests.length === 0) {
    console.log(chalk.green("✓ Không có mercenary requests.\n"));
    return;
  }

  const mercDir = join(ctx.paths.dispatchBase, `step-${step}`, "mercenaries");
  await mkdir(mercDir, { recursive: true });
  const timeout = opts.timeout ?? 3600;

  console.log(
    chalk.yellow.bold(
      `\n╔══════════════════════════════════════════════════════════════╗`,
    ),
  );
  console.log(
    chalk.yellow.bold(`║  🔧 PHASE B — MERCENARY SPAWN BOARD — Step ${step}: ${stepName}`),
  );
  console.log(
    chalk.yellow.bold(`╚══════════════════════════════════════════════════════════════╝\n`),
  );

  for (let i = 0; i < requests.length; i++) {
    const r = requests[i]!;
    const mercType = r.type || "researcher";
    const briefFile = join(mercDir, `${mercType}-${i + 1}-brief.md`);
    const outputFile = join(mercDir, `${mercType}-${i + 1}-output.md`);
    const relBrief = relative(ctx.projectRoot, briefFile);
    const relOutput = relative(ctx.projectRoot, outputFile);

    const brief = `# Mercenary Brief — ${mercType} #${i + 1}

## Context
Requested by: @${r.requested_by}
Blocking: ${r.blocking ?? ""}
Priority: ${r.priority ?? "parallel"}

## Task
${r.query ?? ""}

## Output format
Ghi kết quả vào: ${relOutput}
`;
    await writeFile(briefFile, brief, "utf-8");

    console.log(
      `  ━━━ [Tab ${i + 1}] @mercenary (${mercType}) — for @${r.requested_by} ━━━`,
    );
    console.log(`  Brief:  ${relBrief}`);
    console.log(`  Output: ${relOutput}`);
    console.log("  ┌────────────────────────────────────────────────────────────┐");
    console.log("  │ @.cursor/agents/mercenary-agent.md");
    console.log(`  │ @${relBrief}`);
    console.log("  └────────────────────────────────────────────────────────────┘\n");
  }

  console.log(chalk.magenta.bold("━━━ Sau khi mercenaries hoàn thành: ━━━"));
  for (const r of requests) {
    console.log(
      chalk.bold(`  flowctl dispatch --role ${r.requested_by}  # re-run with mercenary output`),
    );
  }
  console.log(
    chalk.yellow(
      `\nTimeout: mặc định ${timeout}s — flowctl mercenary spawn --timeout <seconds>\n`,
    ),
  );
}
