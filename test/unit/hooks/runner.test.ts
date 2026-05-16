import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mainHookRunner, normalizeHookName, runHook } from "@/hooks/runner";

describe("hooks/runner", () => {
  afterEach(() => {
    process.exitCode = 0;
  });
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

  it("runHook dispatches session-start with state file output", async () => {
    const repo = await mkdtemp(join(tmpdir(), "hook-runner-ss-"));
    const stateFile = join(repo, "flowctl-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        project_name: "Demo",
        current_step: 1,
        steps: { "1": { name: "Req", agent: "pm" } },
      }),
      "utf-8",
    );
    const stdout: string[] = [];
    const code = await runHook("session-start", [], {
      repoRoot: repo,
      env: { FLOWCTL_STATE_FILE: stateFile },
      readStdin: async () => "",
      writeStdout: (s) => stdout.push(s),
      writeStderr: () => {},
    });
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("systemMessage");
    expect(stdout.join("")).toContain("Demo");
  });

  it("runHook dispatches log-bash-event from stdin JSON", async () => {
    const repo = await mkdtemp(join(tmpdir(), "hook-runner-lb-"));
    const stdout: string[] = [];
    const code = await runHook("log-bash-event", [], {
      repoRoot: repo,
      env: { FLOWCTL_CACHE_DIR: join(repo, ".cache", "mcp") },
      readStdin: async () =>
        JSON.stringify({
          hook_event_name: "beforeShellExecution",
          command: "git diff",
        }),
      writeStdout: (s) => stdout.push(s),
      writeStderr: () => {},
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join("").trim()) as { continue: boolean };
    expect(parsed.continue).toBe(true);
  });

  it("mainHookRunner sets exitCode 1 for unknown hook name", async () => {
    await mainHookRunner(["not-a-real-hook"]);
    expect(process.exitCode).toBe(1);
  });
});
