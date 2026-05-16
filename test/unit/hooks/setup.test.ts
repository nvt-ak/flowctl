import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHookScripts, installGitHooks } from "@/hooks/setup";

describe("hooks/setup", () => {
  afterEach(() => {
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

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

  it("installGitHooks sets exitCode when .git/hooks is missing", () => {
    const repo = mkdtempSync(join(tmpdir(), "setup-no-git-"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    installGitHooks(repo);

    expect(process.exitCode).toBe(1);
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/Not a git repo/));
    err.mockRestore();
  });

  it("installGitHooks writes executable hook scripts when .git/hooks exists", () => {
    const repo = mkdtempSync(join(tmpdir(), "setup-git-"));
    const hooksDir = join(repo, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    installGitHooks(repo);

    const preCommit = join(hooksDir, "pre-commit");
    expect(existsSync(preCommit)).toBe(true);
    expect(readFileSync(preCommit, "utf-8")).toContain("git-guards.ts");
    expect(statSync(preCommit).mode & 0o111).not.toBe(0);

    chmodSync(preCommit, 0o644);
    installGitHooks(repo);
    expect(statSync(preCommit).mode & 0o111).not.toBe(0);

    log.mockRestore();
  });
});
