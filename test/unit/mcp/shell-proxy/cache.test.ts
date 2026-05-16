import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ShellProxyCache } from "@/mcp/cache";
import * as shellProxyCache from "@/mcp/shell-proxy/cache";
import { createShellProxyCacheFacade } from "@/mcp/shell-proxy/cache";

describe("mcp/shell-proxy/cache", () => {
  it("does not re-export ShellProxyCache or CacheStrategy (use @/mcp/cache)", () => {
    expect("ShellProxyCache" in shellProxyCache).toBe(false);
    expect("CacheStrategy" in shellProxyCache).toBe(false);
  });

  describe("createShellProxyCacheFacade", () => {
    it("cacheGet returns null on miss", async () => {
      const dir = await mkdtemp(join(tmpdir(), "shell-proxy-facade-"));
      const cache = new ShellProxyCache(dir);
      const facade = createShellProxyCacheFacade(cache, dir);
      expect(facade.cacheGet("missing")).toBeNull();
    });

    it("cacheGet returns data after cacheSet", async () => {
      const dir = await mkdtemp(join(tmpdir(), "shell-proxy-facade-"));
      const cache = new ShellProxyCache(dir);
      const facade = createShellProxyCacheFacade(cache, dir);
      facade.cacheSet("wf_state", { step: 2 }, "state");
      expect(facade.cacheGet("wf_state")).toEqual({ step: 2 });
    });

    it("invalidateAll clears state-scoped entries", async () => {
      const dir = await mkdtemp(join(tmpdir(), "shell-proxy-facade-"));
      const cache = new ShellProxyCache(dir);
      const facade = createShellProxyCacheFacade(cache, dir);
      facade.cacheSet("wf_state", { step: 1 }, "state");
      facade.invalidateAll("state");
      expect(facade.cacheGet("wf_state")).toBeNull();
    });

    it("resolves relative mtime paths against repoRoot", async () => {
      const repoRoot = await mkdtemp(join(tmpdir(), "shell-proxy-repo-"));
      const cacheDir = await mkdtemp(join(tmpdir(), "shell-proxy-facade-"));
      const cache = new ShellProxyCache(cacheDir);
      const facade = createShellProxyCacheFacade(cache, repoRoot);
      const rel = "flowctl-state.json";
      const abs = join(repoRoot, rel);
      await writeFile(abs, '{"step":1}', "utf-8");
      const mtimeMs = (await stat(abs)).mtimeMs;
      facade.cacheSet("wf_read_state", { content: "..." }, "mtime", {
        path: rel,
        mtime: mtimeMs,
      });
      expect(facade.cacheGet("wf_read_state")).toEqual({ content: "..." });
    });
  });
});
