/**
 * `flowctl hook <name>` — internal hook runner for Cursor / Claude Code.
 */
import type { FlowctlContext } from "@/cli/context";
import { runHook } from "@/hooks/runner";

export async function runHookCommand(ctx: FlowctlContext, hookName: string, args: string[]): Promise<void> {
  const code = await runHook(hookName, args, {
    repoRoot: ctx.projectRoot,
    env: {
      ...process.env,
      FLOWCTL_STATE_FILE: ctx.stateFile ?? undefined,
      FLOWCTL_CACHE_DIR: ctx.paths.cacheDir,
      FLOWCTL_EVENTS_F: ctx.paths.eventsFile,
      FLOWCTL_STATS_F: ctx.paths.statsFile,
    },
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString("utf-8");
    },
    writeStdout: (s) => process.stdout.write(s),
    writeStderr: (s) => process.stderr.write(s),
  });
  if (code !== 0) {
    process.exitCode = code;
  }
}
