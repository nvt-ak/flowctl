import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellProxyCache } from "@/mcp/cache";

describe("mcp/ShellProxyCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("second read is cache hit after state-scoped set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    expect(cache.cacheGet("wf_state").hit).toBe(false);

    cache.cacheSet("wf_state", { current_step: 3 }, "state");
    const second = cache.cacheGet("wf_state");
    expect(second.hit).toBe(true);
    if (second.hit) expect(second.data).toEqual({ current_step: 3 });
  });

  it("corrupt cache file yields miss without throwing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    await writeFile(join(dir, "wf_state.json"), "{corrupt:json", "utf-8");
    const cache = new ShellProxyCache(dir);
    expect(cache.cacheGet("wf_state").hit).toBe(false);
  });

  it("invalidate(state) invalidates state-scoped entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("wf_state", { step: 1 }, "state");
    expect(cache.cacheGet("wf_state").hit).toBe(true);
    cache.invalidate("state");
    expect(cache.cacheGet("wf_state").hit).toBe(false);
  });

  it("invalidate(git) does not invalidate state-scoped entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("wf_state", { step: 2 }, "state");
    cache.invalidate("git");
    const r = cache.cacheGet("wf_state");
    expect(r.hit).toBe(true);
    if (r.hit) expect(r.data).toEqual({ step: 2 });
  });

  it("invalidate(state) does not invalidate git-scoped entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("wf_git", { branch: "main" }, "git");
    cache.invalidate("state");
    const r = cache.cacheGet("wf_git");
    expect(r.hit).toBe(true);
  });

  it("TTL entry expires when wall clock passes TTL window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00.000Z"));
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("wf_files", { entries: [] }, "ttl", { ttl: 1 });
    expect(cache.cacheGet("wf_files").hit).toBe(true);

    vi.setSystemTime(new Date("2026-05-16T12:00:03.000Z"));
    expect(cache.cacheGet("wf_files").hit).toBe(false);
  });

  it("invalidate(all) bumps both scopes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("wf_state", { step: 1 }, "state");
    cache.cacheSet("wf_git", { branch: "main" }, "git");
    cache.invalidate("all");
    expect(cache.cacheGet("wf_state").hit).toBe(false);
    expect(cache.cacheGet("wf_git").hit).toBe(false);
  });

  it("mtime strategy misses after file content changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    const target = join(dir, "flowctl-state.json");
    await writeFile(target, '{"step":1}', "utf-8");
    const mtimeMs = (await stat(target)).mtimeMs;
    cache.cacheSet("wf_read_state", { content: "..." }, "mtime", {
      path: target,
      mtime: mtimeMs,
    });
    expect(cache.cacheGet("wf_read_state").hit).toBe(true);

    await writeFile(target, '{"step":2}', "utf-8");
    expect(cache.cacheGet("wf_read_state").hit).toBe(false);
  });

  it("static strategy survives invalidate(all)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("wf_env", { os: "Linux" }, "static");
    cache.invalidate("all");
    const r = cache.cacheGet("wf_env");
    expect(r.hit).toBe(true);
    if (r.hit) expect(r.data).toEqual({ os: "Linux" });
  });

  it("cacheSet writes readable JSON entry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-"));
    const cache = new ShellProxyCache(dir);
    cache.cacheSet("k1", { a: 1 }, "static");
    const raw = await readFile(join(dir, "k1.json"), "utf-8");
    expect(JSON.parse(raw).strategy).toBe("static");
  });
});
