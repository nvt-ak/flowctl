import { describe, expect, it, vi, beforeEach } from "vitest";
import { runHookCommand } from "@/commands/hook";
import { runHook } from "@/hooks/runner";
import { makeCtx } from "../../helpers/ctx";

vi.mock("@/hooks/runner", () => ({
  runHook: vi.fn(),
}));

describe("commands/hook", () => {
  beforeEach(() => {
    vi.mocked(runHook).mockReset();
    process.exitCode = 0;
  });

  it("delegates to runHook with repo env and stdio adapters", async () => {
    vi.mocked(runHook).mockResolvedValue(0);

    await makeCtx(async (ctx) => {
      await runHookCommand(ctx, "session-start", ["--brief"]);
    });

    expect(runHook).toHaveBeenCalledTimes(1);
    const [name, args, deps] = vi.mocked(runHook).mock.calls[0]!;
    expect(name).toBe("session-start");
    expect(args).toEqual(["--brief"]);
    expect(deps.repoRoot).toBeTruthy();
    expect(deps.env?.FLOWCTL_STATE_FILE).toBeTruthy();
    expect(deps.env?.FLOWCTL_CACHE_DIR).toBeTruthy();
    expect(typeof deps.readStdin).toBe("function");
    expect(typeof deps.writeStdout).toBe("function");
    expect(typeof deps.writeStderr).toBe("function");
    expect(process.exitCode).toBe(0);
  });

  it("sets process.exitCode when hook returns non-zero", async () => {
    vi.mocked(runHook).mockResolvedValue(2);

    await makeCtx(async (ctx) => {
      process.exitCode = 0;
      await runHookCommand(ctx, "log-bash-event", []);
      expect(process.exitCode).toBe(2);
    });
  });
});
