import chalk from "chalk";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { initBudgetArtifacts, markRoleBudgetCompleted } from "@/budget/store";
import { captureStepEvidence } from "@/integrations/evidence";
import { collectFromReports } from "@/integrations/report-collect";
import { appendTraceabilityEvent } from "@/integrations/traceability";
import { readState } from "@/state/reader";
import { writeState } from "@/state/writer";
import { pathExists } from "@/utils/fs";
import { requireCurrentStep } from "@/workflow/step-utils";

async function markIdempotencyCompleted(
  file: string,
  step: string,
  reportNames: string[],
): Promise<void> {
  if (!(await pathExists(file))) return;
  type Entry = { status?: string; updated_at?: string };
  const data = JSON.parse(await readFile(file, "utf-8")) as Record<string, Entry>;
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  for (const name of reportNames) {
    const role = name.replace(/-report\.md$/, "");
    const key = `step:${step}:role:${role}:mode:headless`;
    if (data[key]) {
      data[key] = { ...data[key], status: "completed", updated_at: ts };
    }
  }
  await writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function runCollect(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);

  const step = String(requireCurrentStep(read.data));
  const reportsDir = join(ctx.paths.dispatchBase, `step-${step}`, "reports");
  await mkdir(reportsDir, { recursive: true });

  const state = structuredClone(read.data);
  const result = collectFromReports({
    state,
    step,
    repoRoot: ctx.projectRoot,
    reportsDir,
  });

  if (result.noReports) {
    console.log(
      chalk.yellow(
        `No worker reports in ${reportsDir.replace(ctx.projectRoot + "/", "")}.`,
      ),
    );
    console.log(
      chalk.bold("Sample report: .cursor/templates/agent-dispatch-template.md\n"),
    );
    return;
  }

  await writeState(stateFile, state);

  const names = (await readdir(reportsDir)).filter((f) =>
    f.endsWith("-report.md"),
  );
  await markIdempotencyCompleted(ctx.paths.idempotencyFile, step, names);

  await initBudgetArtifacts(ctx.paths.budgetStateFile, ctx.paths.budgetEventsFile);
  for (const name of names) {
    const role = name.replace(/-report\.md$/, "");
    await markRoleBudgetCompleted(
      ctx.paths.budgetStateFile,
      ctx.paths.budgetEventsFile,
      Number(step),
      role,
    );
    const reportRel = join(reportsDir, name).replace(ctx.projectRoot + "/", "");
    const manifestRel = `evidence/step-${step}-manifest.json`;
    await appendTraceabilityEvent(
      ctx.paths.traceabilityFile,
      `collect-${step}-${role}-${Date.now()}`,
      "task",
      { step, role, report: reportRel, manifest: manifestRel },
    );
  }

  const evidenceMsg = await captureStepEvidence({
    step: Number(step),
    repoRoot: ctx.projectRoot,
    evidenceDir: ctx.paths.evidenceDir,
    dispatchBase: ctx.paths.dispatchBase,
  });

  console.log(chalk.green.bold("\nCollect completed."));
  const s = state.steps[step];
  console.log(
    `Step ${step}: deliverables=${s?.deliverables?.length ?? 0}, decisions=${s?.decisions?.length ?? 0}, blockers=${s?.blockers?.length ?? 0}`,
  );
  console.log(
    `COLLECTED reports=${result.reportCount} deliverables+=${result.newDeliverables} decisions+=${result.newDecisions} blockers+=${result.newBlockers} unverified=${result.newUnverified}`,
  );

  if (result.newUnverified > 0) {
    console.log(
      chalk.red.bold(
        `\n⚠️  UNVERIFIED DELIVERABLES: ${result.newUnverified}`,
      ),
    );
    console.log(
      chalk.red(
        "Some DELIVERABLE: claims point to files that do not exist on disk.",
      ),
    );
    console.log(
      chalk.red("→ Check reports. Gate-check will FAIL until resolved.\n"),
    );
  }

  if (evidenceMsg) {
    console.log(chalk.cyan(evidenceMsg));
  }

  for (const sk of result.suggestedSkips) {
    const reason = sk.reason.replace(/\|/g, "/");
    console.log(`SUGGESTED_SKIP|${sk.step}|${reason}|${sk.source}`);
  }
}
