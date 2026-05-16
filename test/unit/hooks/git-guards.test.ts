import { describe, expect, it } from "vitest";
import {
  checkGitGuard,
  messageIfBlocked,
  shouldBlockProtectedBranch,
} from "@/hooks/git-guards";

describe("hooks/git-guards", () => {
  it("shouldBlockProtectedBranch blocks main and master only", () => {
    expect(shouldBlockProtectedBranch("main")).toBe(true);
    expect(shouldBlockProtectedBranch("master")).toBe(true);
    expect(shouldBlockProtectedBranch(" develop ")).toBe(false);
    expect(shouldBlockProtectedBranch("feature/foo")).toBe(false);
  });

  it("messageIfBlocked returns commit vs push copy", () => {
    expect(messageIfBlocked("main", "pre-commit")).toMatch(/Commit blocked/);
    expect(messageIfBlocked("master", "pre-push")).toMatch(/Push blocked/);
    expect(messageIfBlocked("develop", "pre-commit")).toBeNull();
  });

  it("checkGitGuard uses injected branch reader", () => {
    const blocked = checkGitGuard("/tmp/repo", "pre-commit", () => "main");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.message).toMatch(/Commit blocked/);

    const ok = checkGitGuard("/tmp/repo", "pre-push", () => "feature/x");
    expect(ok).toEqual({ ok: true });
  });
});
