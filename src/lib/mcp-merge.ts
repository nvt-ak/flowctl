/**
 * Merge flowctl MCP server definitions into .cursor/mcp.json (TypeScript port of
 * scripts/merge_cursor_mcp.py). Used by `flowctl init` and testable in isolation.
 */
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type McpMergeMode =
  | { type: "scaffold"; workflowCli: string }
  | { type: "setup" };

export type MergeCursorMcpResult = {
  exitCode: number;
  /** First line is MCP_STATUS=…; may include GLOBAL_MCP_STATUS=… */
  lines: string[];
};

function resolveCmd(cmd: string): string {
  const asdfShim = join(homedir(), ".asdf", "shims", cmd);
  try {
    if (existsSync(asdfShim)) {
      accessSync(asdfShim, constants.F_OK | constants.X_OK);
      return asdfShim;
    }
  } catch {
    /* not usable */
  }
  try {
    const found = execFileSync("which", [cmd], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (found.length > 0) return found;
  } catch {
    /* which missing or cmd not found */
  }
  return cmd;
}

type McpServerEntry = {
  command: string;
  args: string[];
  env?: Record<string, string>;
  description: string;
};

export function scaffoldTemplate(workflowCli: string): Record<string, McpServerEntry> {
  const absCmd = resolveCmd(workflowCli);
  return {
    "shell-proxy": {
      command: absCmd,
      args: ["mcp", "--shell-proxy"],
      env: { FLOWCTL_PROJECT_ROOT: "${workspaceFolder}" },
      description:
        "Token-efficient shell proxy — wf_state, wf_git, wf_step_context, " +
        "wf_files, wf_read, wf_env. Replaces bash reads with structured cached JSON. " +
        "Use BEFORE any bash command.",
    },
    "flowctl-state": {
      command: absCmd,
      args: ["mcp", "--workflow-state"],
      env: { FLOWCTL_PROJECT_ROOT: "${workspaceFolder}" },
      description:
        "Workflow state tracker — flow_get_state, flow_advance_step, " +
        "flow_request_approval, flow_add_blocker, flow_add_decision",
    },
  };
}

export function setupTemplate(): Record<string, McpServerEntry> {
  const flowctlCmd = resolveCmd("flowctl");
  const npxCmd = resolveCmd("npx");
  return {
    gitnexus: {
      command: npxCmd,
      args: ["gitnexus", "mcp"],
      env: { GITNEXUS_AUTO_INDEX: "true" },
      description:
        "Git intelligence — smart commits, branch naming, PR descriptions. " +
        "Install: npm install -g gitnexus",
    },
    "flowctl-state": {
      command: flowctlCmd,
      args: ["mcp", "--workflow-state"],
      env: { FLOWCTL_PROJECT_ROOT: "${workspaceFolder}" },
      description: "Workflow state tracker — current step, approvals, blockers",
    },
    "shell-proxy": {
      command: flowctlCmd,
      args: ["mcp", "--shell-proxy"],
      env: { FLOWCTL_PROJECT_ROOT: "${workspaceFolder}" },
      description: "Token-efficient shell proxy — wf_state, wf_git, wf_step_context, wf_files, wf_read, wf_env",
    },
  };
}

function templateForMode(mode: McpMergeMode): Record<string, McpServerEntry> {
  return mode.type === "setup" ? setupTemplate() : scaffoldTemplate(mode.workflowCli);
}

async function writeMcp(
  path: string,
  servers: Record<string, McpServerEntry>,
  keepExtraTop: boolean,
  extraTop: Record<string, unknown>,
): Promise<void> {
  const out: Record<string, unknown> = keepExtraTop ? { ...extraTop } : {};
  out.mcpServers = servers;
  const text = `${JSON.stringify(out, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf-8");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function isNonEmptyFile(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

/** Merge template into one mcp.json (non-overwrite semantics). Returns status keyword. */
async function mergeIntoNonOverwrite(
  path: string,
  template: Record<string, McpServerEntry>,
): Promise<"created" | "merged" | "unchanged" | "invalid_json" | "invalid_structure"> {
  const hadFile = await isNonEmptyFile(path);

  if (!hadFile) {
    await writeMcp(path, { ...template }, false, {});
    return "created";
  }

  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    return "invalid_json";
  }

  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return "invalid_json";
  }

  if (!isRecord(data)) return "invalid_structure";

  const extraTop: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k !== "mcpServers") extraTop[k] = v;
  }

  const serversRaw = data.mcpServers;
  if (serversRaw === undefined) {
    await writeMcp(path, { ...template }, true, extraTop);
    return "merged";
  }

  if (!isRecord(serversRaw)) return "invalid_structure";

  const merged: Record<string, McpServerEntry> = { ...(serversRaw as Record<string, McpServerEntry>) };
  const added: string[] = [];
  for (const [name, spec] of Object.entries(template)) {
    if (!(name in merged)) {
      merged[name] = spec;
      added.push(name);
    }
  }
  await writeMcp(path, merged, true, extraTop);
  return added.length > 0 ? "merged" : "unchanged";
}

/**
 * Merge project `.cursor/mcp.json` and `~/.cursor/mcp.json` like merge_cursor_mcp.py.
 */
export async function mergeCursorMcp(options: {
  mcpPath: string;
  overwrite: boolean;
  mode: McpMergeMode;
  /** When false, skip merging `~/.cursor/mcp.json` (used by unit tests). Default true. */
  mergeGlobal?: boolean;
}): Promise<MergeCursorMcpResult> {
  const { mcpPath, overwrite, mode, mergeGlobal = true } = options;
  const template = templateForMode(mode);
  const lines: string[] = [];
  const push = (s: string) => {
    lines.push(s);
  };

  const hadFile = await isNonEmptyFile(mcpPath);

  if (overwrite) {
    await writeMcp(mcpPath, { ...template }, false, {});
    push(`MCP_STATUS=${hadFile ? "overwritten" : "created"}`);
  } else if (!hadFile) {
    await writeMcp(mcpPath, { ...template }, false, {});
    push("MCP_STATUS=created");
  } else {
    const raw = await readFile(mcpPath, "utf-8");
    let data: unknown;
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      push("MCP_STATUS=invalid_json");
      return { exitCode: 2, lines };
    }

    if (!isRecord(data)) {
      push("MCP_STATUS=invalid_structure");
      return { exitCode: 2, lines };
    }

    const extraTop: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k !== "mcpServers") extraTop[k] = v;
    }

    const serversRaw = data.mcpServers;
    if (serversRaw === undefined) {
      await writeMcp(mcpPath, { ...template }, true, extraTop);
      push("MCP_STATUS=merged");
    } else if (!isRecord(serversRaw)) {
      push("MCP_STATUS=invalid_structure");
      return { exitCode: 2, lines };
    } else {
      const merged: Record<string, McpServerEntry> = {
        ...(serversRaw as Record<string, McpServerEntry>),
      };
      const added: string[] = [];
      for (const [name, spec] of Object.entries(template)) {
        if (!(name in merged)) {
          merged[name] = spec;
          added.push(name);
        }
      }
      await writeMcp(mcpPath, merged, true, extraTop);
      push(`MCP_STATUS=${added.length > 0 ? "merged" : "unchanged"}`);
    }
  }

  if (mergeGlobal) {
    const globalPath = join(homedir(), ".cursor", "mcp.json");
    try {
      const gStatus = await mergeIntoNonOverwrite(globalPath, template);
      if (gStatus === "invalid_json") {
        push("GLOBAL_MCP_STATUS=skipped_invalid_json");
      } else if (gStatus === "invalid_structure") {
        push("GLOBAL_MCP_STATUS=skipped_invalid_structure");
      } else {
        push(`GLOBAL_MCP_STATUS=${gStatus}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EACCES") {
        push(`GLOBAL_MCP_STATUS=skipped_permission_denied (${msg})`);
      } else {
        push(`GLOBAL_MCP_STATUS=skipped_${msg}`);
      }
    }
  }

  return { exitCode: 0, lines };
}
