import type { FlowctlContext } from "@/cli/context";
import { runFlowList } from "@/commands/flow/list";
import { runFlowNew, type FlowNewOptions } from "@/commands/flow/create";
import { runFlowSwitch } from "@/commands/flow/switch";

export type FlowSubcommand = "list" | "new" | "switch";

export async function runFlow(
  ctx: FlowctlContext,
  sub: FlowSubcommand,
  args: string[],
  opts: FlowNewOptions = {},
): Promise<void> {
  switch (sub) {
    case "list":
      return runFlowList(ctx);
    case "new":
      return runFlowNew(ctx, opts);
    case "switch": {
      const target = args[0] ?? "";
      return runFlowSwitch(ctx, target);
    }
    default:
      throw new Error(
        `Subcommand flow không hợp lệ: ${sub}. Usage: flowctl flow list | new | switch <id>`,
      );
  }
}
