/**
 * Sync resolution of MCP cache directory (parity with shell-proxy.js resolveProjectCacheDir).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

type Meta = { path?: string; cache_dir?: string };

function resolveFlowctlHome(repo: string, env: NodeJS.ProcessEnv): string {
  const fromEnv = env.FLOWCTL_HOME?.trim();
  if (fromEnv) return resolve(fromEnv);
  for (const candidate of [".flowctl-local", ".flowctl"]) {
    const p = join(repo, candidate);
    if (existsSync(join(p, "projects"))) return p;
  }
  return join(homedir(), ".flowctl");
}

/** MCP cache dir: FLOWCTL_CACHE_DIR → registry meta → repo/.cache/mcp */
export function resolveProjectMcpCacheDir(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const repo = resolve(repoRoot);
  if (env.FLOWCTL_CACHE_DIR?.trim()) {
    return resolve(env.FLOWCTL_CACHE_DIR.trim());
  }
  const flowctlHome = resolveFlowctlHome(repo, env);
  const projectsDir = join(flowctlHome, "projects");
  if (existsSync(projectsDir)) {
    const repoNorm = resolve(repo);
    for (const entry of readdirSync(projectsDir)) {
      const metaPath = join(projectsDir, entry, "meta.json");
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as Meta;
        if (resolve(meta.path ?? "") === repoNorm && meta.cache_dir) {
          return resolve(meta.cache_dir);
        }
      } catch {
        /* skip corrupt meta */
      }
    }
  }
  return resolve(join(repo, ".cache", "mcp"));
}
