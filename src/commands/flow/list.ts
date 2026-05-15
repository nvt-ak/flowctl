import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { readFlowsIndex } from "@/config/flows-registry";

export async function runFlowList(ctx: FlowctlContext): Promise<void> {
  const index = await readFlowsIndex(ctx.projectRoot);
  if (!index) {
    console.log(
      chalk.yellow(
        "No .flowctl/flows.json — run: flowctl init or flowctl flow new",
      ),
    );
    console.log(`STATE_FILE (resolved): ${ctx.stateFile ?? "<empty>"}`);
    return;
  }

  console.log("active_flow_id:", index.active_flow_id || "(none)");
  console.log("resolved_state_file:", ctx.stateFile ?? "");
  console.log("flows:");
  for (const [fid, meta] of Object.entries(index.flows).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const mark = fid === index.active_flow_id ? " <-- active" : "";
    console.log(
      `  ${fid}  label=${JSON.stringify(meta.label ?? "")}  state_file=${meta.state_file}${mark}`,
    );
  }
}
