import { describe, expect, it } from "vitest";
import { normalizeHookName, runHook } from "@/hooks/runner";

describe("hooks/runner", () => {
  it("normalizeHookName accepts aliases", () => {
    expect(normalizeHookName("log_bash_event")).toBe("log-bash-event");
    expect(normalizeHookName("cursor-shell-event")).toBe("log-bash-event");
    expect(normalizeHookName("invalidate_cache")).toBe("invalidate-cache");
    expect(normalizeHookName("session_start")).toBe("session-start");
    expect(normalizeHookName("unknown")).toBeNull();
  });

  it("runHook dispatches invalidate-cache", async () => {
    const code = await runHook("invalidate-cache", ["git"], {
      repoRoot: process.cwd(),
      env: { FLOWCTL_CACHE_DIR: "/tmp/flowctl-runner-test-cache" },
      readStdin: async () => "",
      writeStdout: () => {},
      writeStderr: () => {},
      invalidate: () => ({ scope: "git", gen: { git: 1, state: 0 } }),
    });
    expect(code).toBe(0);
  });

  it("runHook returns 1 for unknown hook", async () => {
    const code = await runHook("nope", [], {
      repoRoot: process.cwd(),
      env: {},
      readStdin: async () => "",
      writeStdout: () => {},
      writeStderr: (s) => {
        expect(s).toMatch(/Unknown hook/);
      },
    });
    expect(code).toBe(1);
  });
});
