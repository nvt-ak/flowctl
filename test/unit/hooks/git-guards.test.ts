import { afterEach, describe, expect, it, vi } from "vitest";

const mockExecFileSync = vi.hoisted(() =>
  vi.fn((_command?: unknown, _args?: unknown, _options?: unknown) => "feature/x\n"),
);

type ExecFileSync = typeof import("node:child_process")["execFileSync"];

vi.mock("node:child_process", () => ({
  execFileSync: ((...args: Parameters<ExecFileSync>) =>
    mockExecFileSync(...args)) as ExecFileSync,
}));

import {
  checkGitGuard,
  messageIfBlocked,
  runGitGuardMain,
  shouldBlockProtectedBranch,
} from "@/hooks/git-guards";

describe("hooks/git-guards", () => {
  afterEach(() => {
    mockExecFileSync.mockReset();
    mockExecFileSync.mockReturnValue("feature/x\n");
    vi.restoreAllMocks();
  });

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

  it("runGitGuardMain exits 0 on non-protected branch", () => {
    mockExecFileSync.mockReturnValue("feature/x\n");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as typeof process.exit);

    runGitGuardMain(["node", "git-guards.ts", "pre-commit"]);

    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });

  it("runGitGuardMain exits 1 on protected branch", () => {
    mockExecFileSync.mockReturnValue("main\n");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as typeof process.exit);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    runGitGuardMain(["node", "git-guards.ts", "pre-push"]);

    expect(err).toHaveBeenCalledWith(expect.stringMatching(/Push blocked/));
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
    err.mockRestore();
  });

  it("runGitGuardMain exits 2 for invalid kind", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as typeof process.exit);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    runGitGuardMain(["node", "git-guards.ts", "bad-kind"]);

    expect(err).toHaveBeenCalledWith(expect.stringMatching(/Usage:/));
    expect(exit).toHaveBeenCalledWith(2);
    expect(mockExecFileSync).not.toHaveBeenCalled();
    exit.mockRestore();
    err.mockRestore();
  });
});
