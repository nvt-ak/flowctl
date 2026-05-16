import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import { refreshRuntimePaths } from "@/config/paths";
import { initStateFile, setPath } from "@/state/writer";
import type { FlowctlState } from "@/state/schema";
import { withTmpDir } from "./fs";
import { makeState } from "./state";

export type MakeCtxOptions = {
  /** Repo root inside the temp tree (default: `<tmpdir>/repo`). */
  repoSubdir?: string;
  stateRelPath?: string;
  stateOverrides?: Partial<FlowctlState>;
  currentStep?: number;
};

/**
 * Temp repo + initialized state file → `FlowctlContext` for command unit tests.
 */
export async function makeCtx(
  fn: (ctx: FlowctlContext) => Promise<void>,
  options: MakeCtxOptions = {},
): Promise<void> {
  await withTmpDir("flowctl-ctx-", async (root) => {
    const repo = join(root, options.repoSubdir ?? "repo");
    await mkdir(join(repo, "workflows", "gates"), { recursive: true });
    await mkdir(join(repo, "workflows", "dispatch", "step-1", "reports"), {
      recursive: true,
    });
    const stateFile = join(repo, options.stateRelPath ?? ".flowctl/flows/t1/state.json");
    await initStateFile(stateFile);
    const step = options.currentStep ?? 1;
    await setPath(stateFile, "current_step", step);
    await setPath(stateFile, "steps.1.status", "in_progress");
    if (options.stateOverrides) {
      const merged = makeState(options.stateOverrides);
      if (merged.project_name) {
        await setPath(stateFile, "project_name", merged.project_name);
      }
    }
    const paths = await refreshRuntimePaths(repo, stateFile);
    const ctx: FlowctlContext = {
      projectRoot: repo,
      workflowRoot: join(repo, ".."),
      paths,
      stateFile,
      resolveSource: "env_state_file",
    };
    await fn(ctx);
  });
}
