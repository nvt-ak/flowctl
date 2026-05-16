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
});
