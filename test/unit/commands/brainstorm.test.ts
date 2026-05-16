import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FlowctlContext } from "@/cli/context";
import * as context from "@/cli/context";
import { runBrainstorm } from "@/commands/brainstorm";
import { runInit } from "@/commands/init";
import { runTeam } from "@/commands/team/index";
import { refreshRuntimePaths } from "@/config/paths";
import { withTmpDir } from "../../helpers/fs";
import { makeCtx } from "../../helpers/ctx";

vi.mock("@/commands/init", () => ({
  runInit: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/commands/team/index", () => ({
  runTeam: vi.fn(() => Promise.resolve()),
}));

describe("commands/brainstorm", () => {
  beforeEach(() => {
    vi.mocked(runInit).mockClear();
    vi.mocked(runTeam).mockClear();
  });

  it("delegates to team when workflow state exists", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runBrainstorm(ctx, { topic: "auth redesign" });
    });

    expect(runTeam).toHaveBeenCalledWith(expect.anything(), "delegate", {});
    expect(logs.join("\n")).toContain("Brainstorm topic: auth redesign");

    log.mockRestore();
  });

  it("auto-inits when state has no current step then delegates", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await withTmpDir("flowctl-brain-", async (root) => {
      const repo = join(root, "repo");
      await mkdir(repo, { recursive: true });
      const stateFile = join(repo, ".flowctl/flows/x/state.json");
      const paths = await refreshRuntimePaths(repo, stateFile);
      const ctx: FlowctlContext = {
        projectRoot: repo,
        workflowRoot: root,
        paths,
        stateFile,
        resolveSource: "env_state_file",
      };

      const working: FlowctlContext = {
        ...ctx,
        stateFile: join(repo, ".flowctl/flows/y/state.json"),
      };
      vi.spyOn(context, "createContext").mockResolvedValue(working);
      vi.spyOn(context, "invalidateContextCache").mockImplementation(() => {});

      await runBrainstorm(ctx, { project: "Fresh Idea" });

      expect(runInit).toHaveBeenCalledWith(
        ctx,
        expect.objectContaining({ project: "Fresh Idea", noSetup: true }),
      );
      expect(runTeam).toHaveBeenCalledWith(working, "delegate", {});
    });

    log.mockRestore();
    vi.restoreAllMocks();
  });

  it("runs sync after wait when opts.sync is set", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await makeCtx(async (ctx) => {
      const p = runBrainstorm(ctx, { sync: true, waitSeconds: 1 });
      await vi.advanceTimersByTimeAsync(1000);
      await p;
    });

    expect(runTeam).toHaveBeenCalledWith(expect.anything(), "delegate", expect.anything());
    expect(runTeam).toHaveBeenCalledWith(expect.anything(), "sync");

    vi.useRealTimers();
    log.mockRestore();
  });
});
