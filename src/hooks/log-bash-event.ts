/**
 * PostToolUse / beforeShellExecution hook — bash waste detection (port of log-bash-event.py).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolveStateFileForRepo } from "@/integrations/monitor-web-resolve";
import { resolveProjectMcpCacheDir } from "@/mcp/resolve-mcp-cache-dir";

export type LogBashPaths = {
  eventsFile: string;
  statsFile: string;
  stateFile: string | null;
  projectRoot: string;
};

export function resolveLogBashPaths(repoRoot: string, env: NodeJS.ProcessEnv): LogBashPaths {
  const cacheDir = resolveProjectMcpCacheDir(repoRoot, env);
  const eventsFile = env.FLOWCTL_EVENTS_F?.trim() || join(cacheDir, "events.jsonl");
  const statsFile = env.FLOWCTL_STATS_F?.trim() || join(cacheDir, "session-stats.json");
  const stateFile = env.FLOWCTL_STATE_FILE?.trim()
    ? env.FLOWCTL_STATE_FILE.trim()
    : resolveStateFileForRepo(repoRoot);
  return { eventsFile, statsFile, stateFile, projectRoot: repoRoot };
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const quotes = (text.match(/"/g) ?? []).length;
  const nonAscii = [...text].filter((c) => (c.codePointAt(0) ?? 0) > 127).length;
  const jsonRatio = quotes / Math.max(chars, 1);
  const vietRatio = nonAscii / Math.max(chars, 1);
  if (jsonRatio > 0.05) return Math.ceil(chars / 3);
  if (vietRatio > 0.15) return Math.ceil(chars / 2);
  return Math.ceil(chars / 4);
}

type PatternRow = readonly [RegExp, string, number];

// Keep aligned with shell-proxy BASH_EQUIV / Python WASTEFUL_PATTERNS
const WASTEFUL_PATTERNS: PatternRow[] = [
  [/git\s+log/i, "wf_git()", 110],
  [/git\s+status/i, "wf_git()", 110],
  [/git\s+diff/i, "wf_git()", 110],
  [/git\s+branch/i, "wf_git()", 110],
  [/cat\s+flowctl-state/i, "wf_state()", 95],
  [/cat\s+.*\.json/i, "wf_read(path)", 400],
  [/ls\s+-la?/i, "wf_files()", 90],
  [/find\s+\./i, "wf_files()", 90],
  [/wc\s+-l/i, "wf_read(path)", 400],
  [/python3.*flowctl-state/i, "wf_state()", 95],
  [/bash\s+scripts\/flowctl\.sh\s+status/i, "wf_state()", 95],
];

export function checkWasteful(command: string): { suggestion: string | null; mcpAltTokens: number } {
  for (const [pattern, alt, mcpTok] of WASTEFUL_PATTERNS) {
    if (pattern.test(command)) return { suggestion: alt, mcpAltTokens: mcpTok };
  }
  return { suggestion: null, mcpAltTokens: 0 };
}

function readProjectIdentity(
  stateFile: string | null,
  fallbackName: string,
): { flowId: string; projectName: string } {
  if (!stateFile || !existsSync(stateFile)) {
    return { flowId: "", projectName: fallbackName };
  }
  try {
    const s = JSON.parse(readFileSync(stateFile, "utf-8")) as {
      flow_id?: string;
      project_name?: string;
    };
    return {
      flowId: (s.flow_id ?? "").trim(),
      projectName: (s.project_name ?? fallbackName).trim() || fallbackName,
    };
  } catch {
    return { flowId: "", projectName: fallbackName };
  }
}

function ensureParentDir(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
}

function logEvent(
  paths: LogBashPaths,
  event: Record<string, unknown>,
  identity: { flowId: string; projectName: string },
): void {
  ensureParentDir(paths.eventsFile);
  const line = JSON.stringify({
    ...event,
    ts: new Date().toISOString(),
    project_id: identity.flowId,
    project_name: identity.projectName,
  });
  appendFileSync(paths.eventsFile, `${line}\n`, "utf-8");
  updateStats(paths.statsFile, event);
}

function updateStats(statsFile: string, event: Record<string, unknown>): void {
  let stats: Record<string, unknown> = {};
  try {
    if (existsSync(statsFile)) {
      stats = JSON.parse(readFileSync(statsFile, "utf-8")) as Record<string, unknown>;
    }
  } catch {
    stats = {};
  }
  const waste = typeof event.waste_tokens === "number" ? event.waste_tokens : 0;
  stats.bash_waste_tokens = ((stats.bash_waste_tokens as number | undefined) ?? 0) + waste;
  stats.bash_calls = ((stats.bash_calls as number | undefined) ?? 0) + 1;
  try {
    ensureParentDir(statsFile);
    writeFileSync(statsFile, JSON.stringify(stats, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}

/** Claude Code PostToolUse — mutates stderr for waste warning. */
export function handleClaudeCodePostToolUse(
  data: Record<string, unknown>,
  paths: LogBashPaths,
  writeStderr: (s: string) => void,
): void {
  if (data.tool_name !== "Bash") return;
  const toolInput = (data.tool_input as Record<string, unknown> | undefined) ?? {};
  const toolResponse = (data.tool_response as Record<string, unknown> | undefined) ?? {};
  const command = String(toolInput.command ?? "");
  const output = String(toolResponse.output ?? "");
  const outputTokens = estimateTokens(output);
  const { suggestion, mcpAltTokens } = checkWasteful(command);
  const wasteTokens = suggestion ? Math.max(0, outputTokens - mcpAltTokens) : 0;

  if (wasteTokens > 0) {
    const shortCmd = command.length > 60 ? `${command.slice(0, 60)}…` : command;
    writeStderr(
      `\n⚠️  TOKEN WASTE DETECTED\n   Command    : ${shortCmd}\n   Bash cost  : ~${outputTokens.toLocaleString()} tokens\n   Use instead: ${suggestion} (~${mcpAltTokens} tokens)\n   Wasted     : ~${wasteTokens.toLocaleString()} tokens\n\n`,
    );
  }

  const identity = readProjectIdentity(paths.stateFile, basename(paths.projectRoot));
  logEvent(
    paths,
    {
      type: "bash",
      source: "claude-code",
      cmd: command.slice(0, 120),
      output_tokens: outputTokens,
      waste_tokens: wasteTokens,
      suggestion,
    },
    identity,
  );
}

/** Cursor beforeShellExecution — returns JSON string for stdout. */
export function handleCursorBeforeShell(data: Record<string, unknown>, paths: LogBashPaths): string {
  const command = String(data.command ?? "");
  const { suggestion, mcpAltTokens } = checkWasteful(command);
  const identity = readProjectIdentity(paths.stateFile, basename(paths.projectRoot));
  logEvent(
    paths,
    {
      type: "bash",
      source: "cursor",
      cmd: command.slice(0, 120),
      output_tokens: 0,
      waste_tokens: 0,
      suggestion,
      conversation_id: data.conversation_id ?? "",
    },
    identity,
  );

  const response: Record<string, unknown> = { continue: true };
  if (suggestion) {
    const shortCmd = command.length > 60 ? `${command.slice(0, 60)}…` : command;
    response.agentMessage =
      `[flowctl] Consider using ${suggestion} instead of \`${shortCmd}\` — MCP tool costs ~${mcpAltTokens} tokens vs bash output.`;
  }
  return JSON.stringify(response);
}

/** Parse stdin JSON and dispatch (used by CLI / runner). */
export function dispatchLogBashEventJson(
  raw: string,
  paths: LogBashPaths,
  writeStderr: (s: string) => void,
): string | null {
  let data: Record<string, unknown>;
  try {
    data = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
  if (data.hook_event_name === "beforeShellExecution") {
    return handleCursorBeforeShell(data, paths);
  }
  handleClaudeCodePostToolUse(data, paths, writeStderr);
  return null;
}

async function readStdinAll(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export async function mainLogBashEvent(): Promise<void> {
  const raw = await readStdinAll();
  const paths = resolveLogBashPaths(process.cwd(), process.env);
  const out = dispatchLogBashEventJson(raw, paths, (s) => process.stderr.write(s));
  if (out !== null) process.stdout.write(out);
}

if (import.meta.main) {
  void mainLogBashEvent().catch(() => {
    process.exit(0);
  });
}
