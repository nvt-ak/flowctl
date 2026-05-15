import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refreshRuntimePaths, type FlowctlPaths } from "@/config/paths";
import { resolveStatePathWithMigration } from "@/state/resolve-with-migration";
import type { ResolveSource } from "@/state/resolver";

export type FlowctlContext = {
  projectRoot: string;
  workflowRoot: string;
  paths: FlowctlPaths;
  stateFile: string | null;
  resolveSource: ResolveSource | "parse_error";
};

export function workflowRootFromModule(): string {
  return resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

export async function createContext(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<FlowctlContext> {
  const projectRoot = resolve(cwd);
  const workflowRoot = workflowRootFromModule();
  const resolved = await resolveStatePathWithMigration(projectRoot, {
    FLOWCTL_STATE_FILE: env.FLOWCTL_STATE_FILE,
    FLOWCTL_ACTIVE_FLOW: env.FLOWCTL_ACTIVE_FLOW,
    FLOWCTL_HOME: env.FLOWCTL_HOME,
  });
  const paths = await refreshRuntimePaths(projectRoot, resolved.stateFile, {
    flowctlHome: env.FLOWCTL_HOME,
    env: env as Record<string, string | undefined>,
  });
  return {
    projectRoot,
    workflowRoot,
    paths,
    stateFile: resolved.stateFile,
    resolveSource: resolved.source,
  };
}

export function requireStateFile(ctx: FlowctlContext): string {
  if (!ctx.stateFile) {
    throw new Error(
      "Không tìm thấy workflow state. Chạy: flowctl init --project \"Tên dự án\"",
    );
  }
  return ctx.stateFile;
}
