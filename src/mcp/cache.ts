/**
 * MCP shell-proxy cache semantics (parity with scripts/workflow/mcp/shell-proxy.js
 * and tests/test_mcp_cache.py). Used by Vitest; shell-proxy.js remains canonical at runtime until cutover.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type CacheStrategy = "static" | "git" | "state" | "ttl" | "mtime";

export type CacheGetResult = { hit: true; data: unknown } | { hit: false; data: null };

type GenCounters = { git: number; state: number };

type CacheEntry = {
  strategy: CacheStrategy;
  data: unknown;
  ts: number;
  gen?: number;
  ttl?: number;
  path?: string;
  mtime?: number;
};

export class ShellProxyCache {
  private readonly dir: string;

  constructor(cacheDir: string) {
    this.dir = cacheDir;
    mkdirSync(this.dir, { recursive: true });
  }

  private genPath(): string {
    return join(this.dir, "_gen.json");
  }

  private readGen(): GenCounters {
    const p = this.genPath();
    if (!existsSync(p)) return { git: 0, state: 0 };
    try {
      const j = JSON.parse(readFileSync(p, "utf-8")) as GenCounters;
      return {
        git: typeof j.git === "number" ? j.git : 0,
        state: typeof j.state === "number" ? j.state : 0,
      };
    } catch {
      return { git: 0, state: 0 };
    }
  }

  private writeGen(gen: GenCounters): void {
    const tmp = `${this.genPath()}.tmp`;
    writeFileSync(tmp, JSON.stringify(gen));
    renameSync(tmp, this.genPath());
  }

  /** Bump generation counters for invalidation (matches invalidateAll scope rules). */
  invalidate(scope: "all" | "git" | "state" = "all"): GenCounters {
    const gen = this.readGen();
    if (scope === "all" || scope === "git") gen.git = (gen.git || 0) + 1;
    if (scope === "all" || scope === "state") gen.state = (gen.state || 0) + 1;
    this.writeGen(gen);
    return gen;
  }

  cacheGet(key: string): CacheGetResult {
    const f = join(this.dir, `${key}.json`);
    if (!existsSync(f)) return { hit: false, data: null };
    try {
      const entry = JSON.parse(readFileSync(f, "utf-8")) as CacheEntry;
      const gen = this.readGen();
      const now = Date.now();
      const strategy = entry.strategy;

      if (strategy === "static") return { hit: true, data: entry.data };
      if (strategy === "git" && entry.gen === gen.git) return { hit: true, data: entry.data };
      if (strategy === "state" && entry.gen === gen.state) return { hit: true, data: entry.data };
      if (strategy === "ttl" && now - entry.ts < (entry.ttl ?? 60) * 1000) {
        return { hit: true, data: entry.data };
      }
      if (strategy === "mtime") {
        const target = entry.path ?? "";
        if (target && existsSync(target)) {
          const mtimeMs = statSync(target).mtimeMs;
          if (mtimeMs === entry.mtime) return { hit: true, data: entry.data };
        }
      }
    } catch {
      return { hit: false, data: null };
    }
    return { hit: false, data: null };
  }

  cacheSet(
    key: string,
    data: unknown,
    strategy: CacheStrategy,
    extra: { ttl?: number; path?: string; mtime?: number } = {},
  ): void {
    const gen = this.readGen();
    const entry: CacheEntry = {
      strategy,
      data,
      ts: Date.now(),
    };
    if (strategy === "git") entry.gen = gen.git;
    if (strategy === "state") entry.gen = gen.state;
    if (strategy === "ttl") entry.ttl = extra.ttl ?? 60;
    if (strategy === "mtime") {
      entry.path = extra.path ?? "";
      entry.mtime = extra.mtime ?? 0;
    }
    writeFileSync(join(this.dir, `${key}.json`), JSON.stringify(entry));
  }
}
