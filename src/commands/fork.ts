import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FlowctlContext } from "@/cli/context";
import { mutateFlowsIndex, readFlowsIndex } from "@/config/flows-registry";
import { defaultState } from "@/state/default-state";
import { readState } from "@/state/reader";
import { nowTimestamp } from "@/utils/time";

export type ForkOptions = {
  label?: string;
  project?: string;
};

/** Prints eval-able export to stdout; human messages on stderr. */
export async function runFork(
  ctx: FlowctlContext,
  opts: ForkOptions = {},
): Promise<void> {
  let label = (opts.label ?? "").trim();
  if (!label) {
    const d = new Date();
    label = `task-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  }

  let projectName = (opts.project ?? "").trim();
  if (!projectName && ctx.stateFile) {
    const read = await readState(ctx.stateFile);
    if (read.ok) projectName = (read.data.project_name ?? "").trim();
  }
  if (!projectName) projectName = basename(ctx.projectRoot);

  const flowId = `wf-${randomUUID()}`;
  const short = randomUUID().replace(/-/g, "").slice(0, 8);
  const rel = `.flowctl/flows/${short}/state.json`;
  const dest = join(ctx.projectRoot, rel);

  const state = defaultState();
  state.flow_id = flowId;
  state.project_name = projectName;
  state.overall_status = "in_progress";
  state.current_step = 1;
  state.project_description = label;
  const now = nowTimestamp();
  state.created_at = now;
  state.updated_at = now;

  await mkdir(join(ctx.projectRoot, ".flowctl", "flows", short), {
    recursive: true,
  });
  await writeFile(dest, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

  const existing = await readFlowsIndex(ctx.projectRoot);
  await mutateFlowsIndex(ctx.projectRoot, (index) => {
    index.flows[flowId] = { state_file: rel, label };
    if (!existing) {
      index.active_flow_id = flowId;
    }
  });

  console.log(`export FLOWCTL_ACTIVE_FLOW=${flowId}`);
  console.error(`[flowctl fork] Flow '${label}' → ${rel}`);
  console.error("[flowctl fork] Shell isolated. Next command uses isolated flow.");
  console.error("[flowctl fork] View all flows: flowctl flow list");
}
