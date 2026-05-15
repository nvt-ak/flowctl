import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { pathExists } from "@/utils/fs";

export type ResolveSource =
  | "env_state_file"
  | "flows_json"
  | "env_active_flow"
  | "migrated_legacy"
  | "not_initialized"
  | "parse_error";

export type ResolveResult =
  | { stateFile: string; source: Exclude<ResolveSource, "not_initialized" | "parse_error"> }
  | { stateFile: null; source: "not_initialized" | "parse_error" };

type FlowsIndex = {
  active_flow_id?: string;
  flows?: Record<string, { state_file?: string }>;
};

type ProjectMeta = {
  project_id?: string;
  path?: string;
  cache_dir?: string;
};

function norm(p: string): string {
  try {
    return resolve(p);
  } catch {
    return p;
  }
}

function toAbsolute(repoRoot: string, raw: string): string {
  const q = raw.trim();
  if (!q) return "";
  if (isAbsolute(q)) return resolve(q);
  return resolve(repoRoot, q);
}

async function loadFlowsIndex(repoRoot: string): Promise<FlowsIndex | null> {
  const p = resolve(repoRoot, ".flowctl", "flows.json");
  try {
    const text = await readFile(p, "utf-8");
    return JSON.parse(text) as FlowsIndex;
  } catch {
    return null;
  }
}

function metaMatchesRepo(meta: ProjectMeta, repoNorm: string): boolean {
  const path = meta.path ?? "";
  if (!path) return false;
  return norm(path) === repoNorm;
}

async function findStateViaRegistry(
  flowctlHome: string,
  flowId: string,
  repoNorm: string,
): Promise<string | null> {
  const projects = resolve(flowctlHome, "projects");
  const { readdir } = await import("node:fs/promises");
  let entries: string[];
  try {
    entries = await readdir(projects);
  } catch {
    return null;
  }

  for (const child of entries.sort()) {
    const metaPath = resolve(projects, child, "meta.json");
    let meta: ProjectMeta;
    try {
      meta = JSON.parse(await readFile(metaPath, "utf-8")) as ProjectMeta;
    } catch {
      continue;
    }
    if (meta.project_id !== flowId) continue;
    if (!metaMatchesRepo(meta, repoNorm)) continue;
    const cache = meta.cache_dir ?? "";
    if (!cache) continue;
    const candidate = resolve(cache, "..", "workflow", "state.json");
    if (await pathExists(candidate)) return resolve(candidate);
  }
  return null;
}

export type ResolveEnv = {
  FLOWCTL_STATE_FILE?: string;
  FLOWCTL_ACTIVE_FLOW?: string;
  FLOWCTL_HOME?: string;
};

export async function resolveStatePath(
  projectRoot: string,
  env: ResolveEnv = process.env as ResolveEnv,
  opts?: { flowctlHome?: string },
): Promise<ResolveResult> {
  const repo = resolve(projectRoot);
  const repoNorm = norm(repo);
  const flowctlHome = opts?.flowctlHome ?? env.FLOWCTL_HOME ?? resolve(homedir(), ".flowctl");

  const envSF = env.FLOWCTL_STATE_FILE?.trim();
  if (envSF) {
    return {
      stateFile: toAbsolute(repo, envSF),
      source: "env_state_file",
    };
  }

  const flowsIndex = await loadFlowsIndex(repo);
  let activeId = env.FLOWCTL_ACTIVE_FLOW?.trim() || "";
  if (!activeId && flowsIndex?.active_flow_id) {
    activeId = flowsIndex.active_flow_id.trim();
  }

  if (activeId && flowsIndex?.flows?.[activeId]) {
    const entry = flowsIndex.flows[activeId];
    const sf = entry?.state_file?.trim();
    if (sf) {
      return {
        stateFile: toAbsolute(repo, sf),
        source: "flows_json",
      };
    }
  }

  if (activeId) {
    const found = await findStateViaRegistry(flowctlHome, activeId, repoNorm);
    if (found) {
      return { stateFile: found, source: "env_active_flow" };
    }
  }

  return { stateFile: null, source: "not_initialized" };
}
