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
    throw new Error("Thiếu flow id (prefix wf-... hoặc 8 ký tự hex).");
  }

  const existing = await readFlowsIndex(ctx.projectRoot);
  if (!existing) {
    throw new Error(
      "Không tìm thấy .flowctl/flows.json — chạy: flowctl flow new trước",
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
      "Đã switch flow. Terminal mới: export FLOWCTL_ACTIVE_FLOW= hoặc reload MCP.",
    ),
  );
}
