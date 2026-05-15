import { spawn } from "node:child_process";
import { join } from "node:path";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { ensureDataDirs } from "@/config/paths";
import { pathExists } from "@/utils/fs";

export type McpCliOptions = {
  shellProxy?: boolean;
  workflowState?: boolean;
  setup?: boolean;
};

/**
 * `flowctl mcp` — stdio MCP servers (Cursor) or `--setup` snippet (bash cmd_mcp parity).
 */
export async function runMcp(ctx: FlowctlContext, opts: McpCliOptions): Promise<void> {
  const flags = [opts.shellProxy === true, opts.workflowState === true, opts.setup === true].filter(
    Boolean,
  );
  if (flags.length !== 1) {
    console.error(chalk.red("Usage: flowctl mcp --shell-proxy | --workflow-state | --setup"));
    process.exitCode = 1;
    return;
  }

  if (opts.setup === true) {
    const home = ctx.paths.flowctlHome;
    console.log(`\n${chalk.bold(chalk.cyan("flowctl MCP Setup"))}\n`);
    console.log(`Thêm vào ${chalk.bold(".cursor/mcp.json")} của project:\n`);
    const snippet = {
      mcpServers: {
        "shell-proxy": {
          command: "flowctl",
          args: ["mcp", "--shell-proxy"],
          env: {
            FLOWCTL_PROJECT_ROOT: "${workspaceFolder}",
            FLOWCTL_HOME: home,
          },
        },
        "flowctl-state": {
          command: "flowctl",
          args: ["mcp", "--workflow-state"],
          env: {
            FLOWCTL_PROJECT_ROOT: "${workspaceFolder}",
            FLOWCTL_HOME: home,
          },
        },
      },
    };
    console.log(`${JSON.stringify(snippet, null, 2)}\n`);
    console.log(
      `${chalk.yellow("Lưu ý:")} Xóa ${chalk.bold("shell-proxy")} và ${chalk.bold("flowctl-state")} khỏi global ${chalk.bold("~/.cursor/mcp.json")}`,
    );
    console.log("         (giữ lại gitnexus nếu có — nó không phụ thuộc project root)\n");
    return;
  }

  const scriptName =
    opts.shellProxy === true ? "shell-proxy.js" : "workflow-state.js";
  const target = join(ctx.workflowRoot, "scripts", "workflow", "mcp", scriptName);
  if (!(await pathExists(target))) {
    console.error(chalk.red(`Không tìm thấy MCP script: ${target}`));
    process.exitCode = 1;
    return;
  }

  await ensureDataDirs(ctx.paths);
  const env = {
    ...process.env,
    FLOWCTL_PROJECT_ROOT: ctx.projectRoot,
    FLOWCTL_CACHE_DIR: ctx.paths.cacheDir,
    FLOWCTL_EVENTS_F: ctx.paths.eventsFile,
    FLOWCTL_STATS_F: ctx.paths.statsFile,
    FLOWCTL_HOME: ctx.paths.flowctlHome,
  };

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("node", [target], { stdio: "inherit", env });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && code !== null) process.exitCode = code ?? 1;
      resolvePromise();
    });
  });
}
