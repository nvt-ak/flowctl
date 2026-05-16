/**
 * Invalidate MCP shell proxy generation counters (port of invalidate-cache.sh).
 */
import { ShellProxyCache } from "@/mcp/cache";
import { resolveProjectMcpCacheDir } from "@/mcp/resolve-mcp-cache-dir";

export type InvalidateScope = "all" | "git" | "state" | "files";

export function normalizeInvalidateScope(scope: string): "all" | "git" | "state" {
  if (scope === "all" || scope === "git" || scope === "state") return scope;
  if (scope === "files") return "all";
  return "state";
}

/** Bump _gen.json in the resolved MCP cache dir. */
export function invalidateMcpCache(
  repoRoot: string,
  scope: InvalidateScope | string,
  env: NodeJS.ProcessEnv = process.env,
): { scope: string; gen: { git: number; state: number } } {
  const cacheDir = resolveProjectMcpCacheDir(repoRoot, env);
  const cache = new ShellProxyCache(cacheDir);
  const mapped = normalizeInvalidateScope(String(scope));
  const gen = cache.invalidate(mapped);
  return { scope: String(scope), gen };
}

if (import.meta.main) {
  const scope = process.argv[2] ?? "state";
  const out = invalidateMcpCache(process.cwd(), scope);
  console.log(`cache invalidated: scope=${out.scope} gen=${JSON.stringify(out.gen)}`);
}
