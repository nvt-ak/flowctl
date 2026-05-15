import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import {
  mutateFlowsIndex,
  readFlowsIndex,
  resolveFlowId,
} from "@/config/flows-registry";

export async function runFlowSwitch(
  ctx: FlowctlContext,
  target: string,
): Promise<void> {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error("Missing flow id (prefix wf-... or 8 hex characters).");
  }

  const existing = await readFlowsIndex(ctx.projectRoot);
  if (!existing) {
    throw new Error(
      "No .flowctl/flows.json — run: flowctl flow new first",
    );
  }

  const match = resolveFlowId(existing, trimmed);
  if (!match) {
    throw new Error(
      `No flow matches ${JSON.stringify(trimmed)}. Known: ${Object.keys(existing.flows).join(", ")}`,
    );
  }

  await mutateFlowsIndex(ctx.projectRoot, (index) => {
    index.active_flow_id = match;
  });

  console.log(chalk.green(`active_flow_id set to ${match}`));
  console.log(
    chalk.cyan(
      "Switched flow. New terminal: export FLOWCTL_ACTIVE_FLOW= or reload MCP.",
    ),
  );
}
