/**
 * Path / argv helpers for `flowctl monitor` → `scripts/monitor-web.py` (Phase 5 bridge).
 * Full HTTP/SSE server remains Python until a later phase.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { FlowctlPaths } from "@/config/paths";

/** Port of `scripts/lib/state_resolver.resolve_state_file` (flows-first + legacy). */
export function resolveStateFileForRepo(repoRoot: string): string | null {
  const repo = resolve(repoRoot);
  const flowsJson = join(repo, ".flowctl", "flows.json");
  if (existsSync(flowsJson)) {
    try {
      const idx = JSON.parse(readFileSync(flowsJson, "utf-8")) as {
        active_flow_id?: string;
        flows?: Record<string, { state_file?: string }>;
      };
      if (idx && typeof idx === "object") {
        const flows = idx.flows ?? {};
        const active = (idx.active_flow_id ?? "").trim();
        if (active && typeof flows[active] === "object" && flows[active]) {
          const sf = (flows[active].state_file ?? "").trim();
          if (sf) {
            const p = isAbsolute(sf) ? sf : join(repo, sf);
            if (existsSync(p)) return resolve(p);
          }
        }
        for (const meta of Object.values(flows)) {
          if (!meta || typeof meta !== "object") continue;
          const sf = (meta.state_file ?? "").trim();
          if (!sf) continue;
          const p = isAbsolute(sf) ? sf : join(repo, sf);
          if (existsSync(p)) return resolve(p);
        }
      }
    } catch {
      /* fall through to legacy */
    }
  }
  const legacy = join(repo, "flowctl-state.json");
  return existsSync(legacy) ? resolve(legacy) : null;
}

/** Port of monitor-web `_flowctl_project_signals`. */
export function flowctlProjectSignals(repoRoot: string): boolean {
  const repo = resolve(repoRoot);
  if (existsSync(join(repo, ".flowctl", "flows.json"))) return true;
  if (resolveStateFileForRepo(repo) !== null) return true;
  return existsSync(join(repo, "flowctl-state.json"));
}

const SUBCMD = new Set(["monitor", "mon"]);

/** Robust passthrough of argv after `monitor` / `mon` (works with `bun run …/index.ts monitor …`). */
export function sliceMonitorPassthrough(argv: string[]): string[] {
  for (let i = 1; i < argv.length; i++) {
    if (SUBCMD.has(argv[i]!)) {
      return argv.slice(i + 1);
    }
  }
  return [];
}

function shouldInjectGlobalMonitor(stateFile: string | null, passthroughArgs: string[]): boolean {
  const a0 = passthroughArgs[0];
  if (a0 === "--once" || a0 === "--global") return false;
  if (stateFile && existsSync(stateFile)) return false;
  return true;
}

export type MonitorLaunchPlan = {
  python: string;
  scriptPath: string;
  argv: string[];
  env: NodeJS.ProcessEnv;
};

export function prepareMonitorWebLaunch(input: {
  workflowRoot: string;
  projectRoot: string;
  stateFile: string | null;
  paths: Pick<FlowctlPaths, "cacheDir" | "eventsFile" | "statsFile">;
  passthroughArgs: string[];
  extraEnv?: NodeJS.ProcessEnv;
}): MonitorLaunchPlan {
  const scriptPath = resolve(input.workflowRoot, "scripts", "monitor-web.py");
  const inject = shouldInjectGlobalMonitor(input.stateFile, input.passthroughArgs);
  const argv = inject ? ["--global", ...input.passthroughArgs] : [...input.passthroughArgs];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(input.extraEnv ?? {}),
    FLOWCTL_PROJECT_ROOT: input.projectRoot,
    FLOWCTL_CACHE_DIR: input.paths.cacheDir,
    FLOWCTL_EVENTS_F: input.paths.eventsFile,
    FLOWCTL_STATS_F: input.paths.statsFile,
  };
  const python = process.platform === "win32" ? "python" : "python3";
  return { python, scriptPath, argv, env };
}
