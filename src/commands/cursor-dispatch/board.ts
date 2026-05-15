import chalk from "chalk";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlowctlState } from "@/state/schema";
import { collectStepRoles } from "@/commands/dispatch/roles";
import { pathExists } from "@/utils/fs";

export async function printSpawnBoard(opts: {
  state: FlowctlState;
  step: string;
  stepName: string;
  projectRoot: string;
  dispatchDir: string;
  stateFile: string;
}): Promise<void> {
  const roles = collectStepRoles(opts.state, opts.step);
  const reportsDir = join(opts.dispatchDir, "reports");
  await mkdir(reportsDir, { recursive: true });

  const digestFile = join(opts.dispatchDir, "context-digest.md");
  const hasDigest = await pathExists(digestFile);

  console.log("");
  console.log(
    chalk.blue.bold(
      `╔══════════════════════════════════════════════════════════════╗`,
    ),
  );
  console.log(
    chalk.blue.bold(
      `║  CURSOR SPAWN BOARD — Step ${opts.step}: ${opts.stepName}`,
    ),
  );
  console.log(
    chalk.blue.bold(
      `╚══════════════════════════════════════════════════════════════╝`,
    ),
  );
  console.log("");
  console.log(`  Briefs:  ${opts.dispatchDir.replace(`${opts.projectRoot}/`, "")}/`);
  console.log(`  Reports: ${reportsDir.replace(`${opts.projectRoot}/`, "")}/`);
  if (hasDigest) {
    console.log(
      chalk.green(
        `  Context digest: ${digestFile.replace(`${opts.projectRoot}/`, "")} ✓`,
      ),
    );
  }
  console.log("");
  console.log(chalk.green.bold("▶ MODE B — Task subagents (DEFAULT)"));
  console.log("  PM: spawn one Task per role (is_background: true when parallel).\n");

  for (const role of roles) {
    const briefRel = join(opts.dispatchDir, `${role}-brief.md`).replace(
      `${opts.projectRoot}/`,
      "",
    );
    const reportAbs = join(reportsDir, `${role}-report.md`);
    console.log(chalk.cyan(`  Spawn @${role}:`));
    console.log(`    subagent_type: ${role}`);
    console.log(`    description: Execute step-${opts.step} as @${role}`);
    console.log(`    instructions: Read @${briefRel}; write report: ${reportAbs}`);
    console.log("");
  }

  if (opts.stateFile.includes("/.flowctl/flows/")) {
    console.log(chalk.yellow("Multi-flow state:"));
    console.log(chalk.bold(`  export FLOWCTL_STATE_FILE="${opts.stateFile}"`));
    console.log("");
  }

  console.log(chalk.magenta.bold("━━━ Khi agents hoàn thành ━━━"));
  console.log(chalk.bold("  flowctl collect\n"));

  const boardFile = join(opts.dispatchDir, "spawn-board.txt");
  await writeFile(
    boardFile,
    [
      `CURSOR SPAWN BOARD — Step ${opts.step}: ${opts.stepName}`,
      `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      `Roles: ${roles.join(", ")}`,
      `Context digest: ${hasDigest}`,
      opts.stateFile.includes("/.flowctl/flows/")
        ? `FLOWCTL_STATE_FILE=${opts.stateFile}`
        : "",
    ]
      .filter(Boolean)
      .join("\n") + "\n",
    "utf-8",
  );
  console.log(`  Spawn board saved: ${boardFile.replace(`${opts.projectRoot}/`, "")}\n`);
}
