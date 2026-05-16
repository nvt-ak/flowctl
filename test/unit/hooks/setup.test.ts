import { describe, expect, it } from "vitest";
import { buildHookScripts } from "@/hooks/setup";

describe("hooks/setup", () => {
  it("buildHookScripts embeds repo-relative paths and quality gate npm script", () => {
    const hooks = buildHookScripts();
    expect(hooks["pre-commit"]).toContain("git-guards.ts");
    expect(hooks["pre-commit"]).toContain("prevent-main-commit.sh");
    expect(hooks["pre-push"]).toContain("git-guards.ts");
    expect(hooks["pre-push"]).toContain('npm run test:gate:local');
    expect(hooks["post-commit"]).toContain("invalidate-cache.ts");
    expect(hooks["post-merge"]).toContain("invalidate-cache.ts");
    expect(hooks["post-checkout"]).toContain("invalidate-cache.ts");
  });
});
