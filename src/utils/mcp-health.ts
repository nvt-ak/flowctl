import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { pathExists } from "@/utils/fs";
import { todayIso } from "@/utils/time";

const ISSUE_MISSING_MCP_JSON =
  ".cursor/mcp.json chưa có — MCP servers chưa được cấu hình cho project này.";
const ISSUE_MISSING_FLOWCTL_HOME =
  "shell-proxy trong `.cursor/mcp.json` thiếu `FLOWCTL_HOME` → cache ghi sai đường dẫn, token savings không hoạt động.";
const ISSUE_EMPTY_EVENTS =
  "MCP shell-proxy chưa có tool call nào được ghi nhận (`events.jsonl` trống) — workers có thể đang bỏ qua `wf_state()`/`wf_step_context()` và dùng bash thay thế.";

const SEEN_WARNINGS_FILE = "seen-mcp-warnings.txt";

export function shouldSkipMcpHealth(
  env: Record<string, string | undefined>,
): boolean {
  return env.WF_SKIP_MCP_HEALTH === "1";
}

export function mcpHealthMarker(today: string): string {
  return `${today} mcp-health`;
}

export function shellProxyHasFlowctlHome(mcpJson: unknown): boolean {
  if (!mcpJson || typeof mcpJson !== "object") return false;
  const servers = (mcpJson as { mcpServers?: Record<string, unknown> })
    .mcpServers;
  const sp = servers?.["shell-proxy"];
  if (!sp || typeof sp !== "object") return false;
  const env = (sp as { env?: Record<string, unknown> }).env;
  return Boolean(env && typeof env === "object" && "FLOWCTL_HOME" in env);
}

export type CollectMcpHealthInput = {
  mcpJsonPath: string;
  eventsFile: string;
  mcpJsonExists: boolean;
  mcpJson?: unknown;
  eventsNonEmpty: boolean;
};

/** Pure issue collection — port of `wf_mcp_health_check` checks 1–3. */
export function collectMcpHealthIssues(input: CollectMcpHealthInput): string[] {
  const issues: string[] = [];

  if (!input.mcpJsonExists) {
    issues.push(ISSUE_MISSING_MCP_JSON);
  } else if (!shellProxyHasFlowctlHome(input.mcpJson)) {
    issues.push(ISSUE_MISSING_FLOWCTL_HOME);
  }

  if (!input.eventsNonEmpty) {
    issues.push(ISSUE_EMPTY_EVENTS);
  }

  return issues;
}

function seenWarningsPath(flowctlHome: string): string {
  return join(flowctlHome, SEEN_WARNINGS_FILE);
}

export async function hasWarnedToday(
  flowctlHome: string,
  today: string,
): Promise<boolean> {
  const path = seenWarningsPath(flowctlHome);
  if (!(await pathExists(path))) return false;
  const raw = await readFile(path, "utf-8");
  return raw.includes(mcpHealthMarker(today));
}

export async function recordWarnedToday(
  flowctlHome: string,
  today: string,
): Promise<void> {
  const { mkdir, appendFile } = await import("node:fs/promises");
  await mkdir(flowctlHome, { recursive: true });
  await appendFile(seenWarningsPath(flowctlHome), `${mcpHealthMarker(today)}\n`, "utf-8");
}

async function eventsFileNonEmpty(eventsFile: string): Promise<boolean> {
  if (!(await pathExists(eventsFile))) return false;
  const st = await stat(eventsFile);
  return st.size > 0;
}

async function loadMcpJson(mcpJsonPath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(mcpJsonPath, "utf-8")) as unknown;
  } catch {
    return undefined;
  }
}

export function printMcpHealthWarnings(
  issues: string[],
  log: (line: string) => void = console.log,
): void {
  log("");
  log(chalk.yellow.bold("⚠  MCP Health Check"));
  for (const issue of issues) {
    log(`  ${chalk.yellow("•")} ${issue}`);
  }
  log(`  ${chalk.cyan("→ Xem hướng dẫn: flowctl mcp --setup")}\n`);
}

export type RunMcpHealthCheckOptions = {
  env?: NodeJS.ProcessEnv;
  log?: (line: string) => void;
  today?: () => string;
};

/**
 * Non-blocking MCP wiring check (bash `wf_mcp_health_check`).
 * Warns at most once per calendar day per FLOWCTL_HOME.
 */
export async function runMcpHealthCheck(
  ctx: FlowctlContext,
  opts: RunMcpHealthCheckOptions = {},
): Promise<void> {
  const env = opts.env ?? process.env;
  if (shouldSkipMcpHealth(env as Record<string, string | undefined>)) {
    return;
  }

  const today = opts.today?.() ?? todayIso();
  const flowctlHome = ctx.paths.flowctlHome;
  if (await hasWarnedToday(flowctlHome, today)) {
    return;
  }

  const mcpJsonPath = join(ctx.projectRoot, ".cursor", "mcp.json");
  const mcpJsonExists = await pathExists(mcpJsonPath);
  const mcpJson = mcpJsonExists ? await loadMcpJson(mcpJsonPath) : undefined;
  const eventsNonEmpty = await eventsFileNonEmpty(ctx.paths.eventsFile);

  const issues = collectMcpHealthIssues({
    mcpJsonPath,
    eventsFile: ctx.paths.eventsFile,
    mcpJsonExists,
    mcpJson,
    eventsNonEmpty,
  });

  if (issues.length === 0) return;

  const log = opts.log ?? console.log;
  printMcpHealthWarnings(issues, log);
  await recordWarnedToday(flowctlHome, today);
}
