import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { invalidateMcpCache, normalizeInvalidateScope } from "@/hooks/invalidate-cache";

describe("hooks/invalidate-cache", () => {
  it("normalizeInvalidateScope maps files to all and unknown to state", () => {
    expect(normalizeInvalidateScope("all")).toBe("all");
    expect(normalizeInvalidateScope("git")).toBe("git");
    expect(normalizeInvalidateScope("files")).toBe("all");
    expect(normalizeInvalidateScope("nope")).toBe("state");
  });

  it("invalidateMcpCache bumps _gen.json counters", async () => {
    const repo = await mkdtemp(join(tmpdir(), "inv-cache-"));
    const cacheDir = join(repo, ".cache", "mcp");
    const out = invalidateMcpCache(repo, "git", { FLOWCTL_CACHE_DIR: cacheDir });
    expect(out.scope).toBe("git");
    expect(out.gen.git).toBe(1);
    expect(out.gen.state).toBe(0);

    const gen = JSON.parse(await readFile(join(cacheDir, "_gen.json"), "utf-8")) as {
      git: number;
      state: number;
    };
    expect(gen.git).toBe(1);
  });

  it("invalidateMcpCache creates cache dir when path does not exist yet", async () => {
    const repo = await mkdtemp(join(tmpdir(), "inv-cache-missing-"));
    const cacheDir = join(repo, "nested", "cache", "mcp");
    const out = invalidateMcpCache(repo, "state", { FLOWCTL_CACHE_DIR: cacheDir });
    expect(out.scope).toBe("state");
    expect(out.gen.state).toBe(1);
    const gen = JSON.parse(await readFile(join(cacheDir, "_gen.json"), "utf-8")) as {
      state: number;
    };
    expect(gen.state).toBe(1);
  });

  it("invalidateMcpCache recovers when _gen.json is corrupt", async () => {
    const repo = await mkdtemp(join(tmpdir(), "inv-cache-bad-gen-"));
    const cacheDir = join(repo, ".cache", "mcp");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "_gen.json"), "not-json", "utf-8");

    const out = invalidateMcpCache(repo, "all", { FLOWCTL_CACHE_DIR: cacheDir });
    expect(out.gen.git).toBe(1);
    expect(out.gen.state).toBe(1);
  });
});
