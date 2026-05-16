import { describe, expect, it, vi, afterEach } from "vitest";
import { execa } from "execa";
import { runMonitor } from "@/commands/monitor";
import type { FlowctlContext } from "@/cli/context";
import { refreshRuntimePaths } from "@/config/paths";
import { withTmpDir } from "../../helpers/fs";

vi.mock("execa", () => ({
  execa: vi.fn(() => Promise.resolve({})),
}));

describe("commands/monitor", () => {
  afterEach(() => {
    vi.mocked(execa).mockClear();
  });

  it("invokes python monitor-web.py with prepared argv and env", async () => {
    await withTmpDir("flowctl-monitor-", async (root) => {
      const repo = `${root}/repo`;
      const paths = await refreshRuntimePaths(repo, null);
      const ctx: FlowctlContext = {
        projectRoot: repo,
        workflowRoot: root,
        paths,
        stateFile: null,
        resolveSource: "not_initialized",
      };

      await runMonitor(ctx, ["--once"]);

      expect(execa).toHaveBeenCalledTimes(1);
      const [python, argv, opts] = vi.mocked(execa).mock.calls[0]!;
      expect(python).toBe(process.platform === "win32" ? "python" : "python3");
      expect(String(argv[0])).toContain("monitor-web.py");
      expect(argv).toContain("--once");
      expect(opts?.stdio).toBe("inherit");
      expect(opts?.env?.FLOWCTL_PROJECT_ROOT).toBe(repo);
      expect(opts?.env?.FLOWCTL_CACHE_DIR).toBe(paths.cacheDir);
    });
  });
});
