import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");
const pkg = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf-8"),
) as { version: string };

describe("flowctl CLI foundation", () => {
  it("package.json version is semver-shaped", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("cli entry file exists", async () => {
    const { pathExists } = await import("@/utils/fs");
    expect(await pathExists(join(repoRoot, "src/cli/index.ts"))).toBe(true);
  });
});
