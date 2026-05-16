/**
 * Shell-proxy cache helpers — wraps {@link ShellProxyCache} with JS parity helpers.
 * Import {@link ShellProxyCache} and {@link CacheStrategy} from `@/mcp/cache`.
 */
import { resolve } from "node:path";
import { ShellProxyCache } from "@/mcp/cache";

export function createShellProxyCacheFacade(cache: ShellProxyCache, repoRoot: string) {
  return {
    cacheGet(key: string): unknown | null {
      const r = cache.cacheGet(key);
      return r.hit ? r.data : null;
    },
    cacheSet(
      key: string,
      data: unknown,
      strategy: "static" | "git" | "state" | "ttl" | "mtime",
      extra: { ttl?: number; path?: string; mtime?: number } = {},
    ): void {
      const mtimeExtra =
        strategy === "mtime" && extra.path
          ? {
              ...extra,
              path: extra.path.startsWith("/") ? extra.path : resolve(repoRoot, extra.path),
            }
          : extra;
      cache.cacheSet(key, data, strategy, mtimeExtra);
    },
    invalidateAll(scope: "all" | "git" | "state" = "all") {
      return cache.invalidate(scope);
    },
  };
}
