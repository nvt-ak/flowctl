/**
 * Sync state path for MCP servers (parity with workflow-state.js / shell-proxy.js fallbacks).
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

type FlowsIndex = {
  active_flow_id?: string;
  flows?: Record<string, { state_file?: string }>;
};

function loadFlowsIndex(repo: string): FlowsIndex | null {
  const p = join(repo, ".flowctl", "flows.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as FlowsIndex;
  } catch {
    return null;
  }
}

/** Resolved path; falls back to repo/flowctl-state.json like legacy MCP JS. */
export function resolveMcpStatePath(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const repo = resolve(repoRoot);
  const envSF = env.FLOWCTL_STATE_FILE?.trim();
  if (envSF) {
    return isAbsolute(envSF) ? resolve(envSF) : resolve(repo, envSF);
  }

  const flows = loadFlowsIndex(repo);
  let activeId = env.FLOWCTL_ACTIVE_FLOW?.trim() || "";
  if (!activeId && flows?.active_flow_id) {
    activeId = flows.active_flow_id.trim();
  }
  if (activeId && flows?.flows?.[activeId]) {
    const sf = flows.flows[activeId]?.state_file?.trim();
    if (sf) {
      return isAbsolute(sf) ? resolve(sf) : resolve(repo, sf);
    }
  }

  return join(repo, "flowctl-state.json");
}

/** Dispatch base aligned with shell-proxy.js / config.sh. */
export function resolveMcpDispatchBase(
  repoRoot: string,
  statePath: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.DISPATCH_BASE?.trim()) {
    return resolve(env.DISPATCH_BASE.trim());
  }
  try {
    const raw = existsSync(statePath) ? readFileSync(statePath, "utf-8") : "";
    const fid = ((JSON.parse(raw || "{}") as { flow_id?: string }).flow_id ?? "").trim();
    if (fid.length >= 11 && fid.startsWith("wf-")) {
      return join(repoRoot, "workflows", fid.slice(3, 11), "dispatch");
    }
  } catch {
    /* ignore */
  }
  return join(repoRoot, "workflows", "dispatch");
}

export function resolveFlowctlHomeForMcp(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.FLOWCTL_HOME?.trim()) return resolve(env.FLOWCTL_HOME.trim());
  for (const candidate of [".flowctl-local", ".flowctl"]) {
    const p = join(repoRoot, candidate);
    if (existsSync(join(p, "projects"))) return p;
  }
  return join(homedir(), ".flowctl");
}
