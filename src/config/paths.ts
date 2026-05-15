import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathExists } from "@/utils/fs";

/** Runtime paths derived from config.sh `flowctl_refresh_runtime_paths`. */
export interface FlowctlPaths {
  flowctlHome: string;
  dataDir: string;
  cacheDir: string;
  runtimeDir: string;
  stateFile: string | null;
  idempotencyFile: string;
  roleSessionsFile: string;
  heartbeatsFile: string;
  budgetStateFile: string;
  budgetEventsFile: string;
  eventsFile: string;
  statsFile: string;
  traceabilityFile: string;
  evidenceDir: string;
  releaseDashboardDir: string;
  dispatchBase: string;
  gateReportsDir: string;
  retroDir: string;
  workflowLockDir: string;
  rolePolicyFile: string;
  budgetPolicyFile: string;
  qaGateFile: string;
  registryFile: string;
}

export type RefreshPathsEnv = {
  FLOWCTL_HOME?: string;
  FLOWCTL_DATA_DIR?: string;
  FLOWCTL_CACHE_DIR?: string;
  FLOWCTL_RUNTIME_DIR?: string;
  FLOWCTL_EVENTS_F?: string;
  FLOWCTL_STATS_F?: string;
};

type StateMeta = { flowId: string; projectName: string };

/** Port of `_flowctl_make_slug` in config.sh. */
export function makeSlug(name: string): string {
  const lowered = name.toLowerCase();
  const slug = lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "project";
}

async function readStateMeta(stateFile: string | null): Promise<StateMeta> {
  if (!stateFile || !(await pathExists(stateFile))) {
    return { flowId: "", projectName: "" };
  }
  try {
    const raw = JSON.parse(await readFile(stateFile, "utf-8")) as {
      flow_id?: string;
      project_name?: string;
    };
    return {
      flowId: (raw.flow_id ?? "").trim(),
      projectName: (raw.project_name ?? "").trim(),
    };
  } catch {
    return { flowId: "", projectName: "" };
  }
}

function flowShortId(flowId: string): string {
  if (flowId.length > 11) {
    return flowId.slice(3, 11);
  }
  return "";
}

export async function refreshRuntimePaths(
  projectRoot: string,
  stateFile: string | null,
  opts: { flowctlHome?: string; env?: RefreshPathsEnv } = {},
): Promise<FlowctlPaths> {
  const repo = resolve(projectRoot);
  const env = opts.env ?? (process.env as RefreshPathsEnv);
  const flowctlHome = opts.flowctlHome ?? env.FLOWCTL_HOME ?? join(homedir(), ".flowctl");

  let workflowLockDir = join(repo, ".flowctl", "locks", "unset");
  if (stateFile) {
    const hash = createHash("sha256").update(stateFile).digest("hex").slice(0, 16);
    workflowLockDir = join(repo, ".flowctl", "locks", hash);
  }

  const { flowId, projectName } = await readStateMeta(stateFile);
  const short = flowShortId(flowId);

  let dataDir: string;
  if (flowId) {
    const slug = makeSlug(projectName || "project");
    dataDir =
      env.FLOWCTL_DATA_DIR?.trim() ||
      join(flowctlHome, "projects", `${slug}-${short}`);
  } else {
    dataDir = env.FLOWCTL_DATA_DIR?.trim() || join(repo, ".cache", "flowctl");
  }

  const cacheDir = env.FLOWCTL_CACHE_DIR?.trim() || join(dataDir, "cache");
  const runtimeDir = env.FLOWCTL_RUNTIME_DIR?.trim() || join(dataDir, "runtime");
  const eventsFile = env.FLOWCTL_EVENTS_F?.trim() || join(cacheDir, "events.jsonl");
  const statsFile = env.FLOWCTL_STATS_F?.trim() || join(cacheDir, "session-stats.json");

  let dispatchBase: string;
  let gateReportsDir: string;
  let retroDir: string;
  if (short) {
    dispatchBase = join(repo, "workflows", short, "dispatch");
    gateReportsDir = join(repo, "workflows", short, "gates", "reports");
    retroDir = join(repo, "workflows", short, "retro");
  } else {
    dispatchBase = join(repo, "workflows", "dispatch");
    gateReportsDir = join(repo, "workflows", "gates", "reports");
    retroDir = join(repo, "workflows", "retro");
  }

  return {
    flowctlHome,
    dataDir,
    cacheDir,
    runtimeDir,
    stateFile,
    idempotencyFile: join(runtimeDir, "idempotency.json"),
    roleSessionsFile: join(runtimeDir, "role-sessions.json"),
    heartbeatsFile: join(runtimeDir, "heartbeats.jsonl"),
    budgetStateFile: join(runtimeDir, "budget-state.json"),
    budgetEventsFile: join(runtimeDir, "budget-events.jsonl"),
    eventsFile,
    statsFile,
    traceabilityFile: join(runtimeDir, "traceability-map.jsonl"),
    evidenceDir: join(runtimeDir, "evidence"),
    releaseDashboardDir: join(runtimeDir, "release-dashboard"),
    dispatchBase,
    gateReportsDir,
    retroDir,
    workflowLockDir,
    rolePolicyFile: join(repo, "workflows", "policies", "role-policy.v1.json"),
    budgetPolicyFile: join(repo, "workflows", "policies", "budget-policy.v1.json"),
    qaGateFile: join(repo, "workflows", "gates", "qa-gate.v1.json"),
    registryFile: join(flowctlHome, "registry.json"),
  };
}

/** Port of `flowctl_ensure_data_dirs` (mkdir only). */
export async function ensureDataDirs(paths: FlowctlPaths): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(paths.cacheDir, { recursive: true });
  await mkdir(paths.evidenceDir, { recursive: true });
  await mkdir(paths.releaseDashboardDir, { recursive: true });
  await mkdir(join(paths.flowctlHome, "projects"), { recursive: true });
}
