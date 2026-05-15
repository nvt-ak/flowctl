import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { mutateFlowsIndex } from "@/config/flows-registry";
import { defaultState } from "@/state/default-state";
import { readState } from "@/state/reader";
import { nowTimestamp } from "@/utils/time";

export type FlowNewOptions = {
  label?: string;
  project?: string;
};

export async function runFlowNew(
  ctx: FlowctlContext,
  opts: FlowNewOptions = {},
): Promise<void> {
  let projectName = (opts.project ?? "").trim();
  if (!projectName && ctx.stateFile) {
    const read = await readState(ctx.stateFile);
    if (read.ok) {
      projectName = (read.data.project_name ?? "").trim();
    }
  }
  if (!projectName) projectName = "Project";

  const flowId = `wf-${randomUUID()}`;
  const short = randomUUID().replace(/-/g, "").slice(0, 10);
  const rel = `.flowctl/flows/${short}/state.json`;
  const dest = join(ctx.projectRoot, rel);

  const state = defaultState();
  state.flow_id = flowId;
  state.project_name = projectName;
  if (opts.label?.trim()) {
    state.project_description = opts.label.trim();
  }
  const now = nowTimestamp();
  state.created_at = state.created_at || now;
  state.updated_at = now;

  await mkdir(join(ctx.projectRoot, ".flowctl", "flows", short), {
    recursive: true,
  });
  await writeFile(dest, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

  const label = opts.label?.trim() ?? "";
  await mutateFlowsIndex(ctx.projectRoot, (index) => {
    index.flows[flowId] = { state_file: rel, label };
    index.active_flow_id = flowId;
  });

  console.log(chalk.green(`flow mới: ${flowId} → ${rel} (active)`));
  console.log(
    chalk.cyan(`Song song: terminal khác → export FLOWCTL_STATE_FILE=${dest}`),
  );
}
