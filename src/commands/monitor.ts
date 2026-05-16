/**
 * `flowctl monitor` — delegates to Python `scripts/monitor-web.py` (Phase 5 bridge).
 */
import { execa } from "execa";
import type { FlowctlContext } from "@/cli/context";
import { prepareMonitorWebLaunch } from "@/integrations/monitor-web-resolve";

export async function runMonitor(
  ctx: FlowctlContext,
  passthroughArgs: string[],
): Promise<void> {
  const plan = prepareMonitorWebLaunch({
    workflowRoot: ctx.workflowRoot,
    projectRoot: ctx.projectRoot,
    stateFile: ctx.stateFile,
    paths: {
      cacheDir: ctx.paths.cacheDir,
      eventsFile: ctx.paths.eventsFile,
      statsFile: ctx.paths.statsFile,
    },
    passthroughArgs,
  });
  await execa(plan.python, [plan.scriptPath, ...plan.argv], {
    env: plan.env,
    stdio: "inherit",
  });
}
