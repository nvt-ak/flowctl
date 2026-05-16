/**
 * `flowctl hook <name>` dispatcher (Phase 6).
 */
import { resolveStateFileForRepo } from "@/integrations/monitor-web-resolve";
import { invalidateMcpCache } from "@/hooks/invalidate-cache";
import { dispatchLogBashEventJson, mainLogBashEvent, resolveLogBashPaths } from "@/hooks/log-bash-event";
import { buildSessionStartMessage } from "@/hooks/session-start";

export type CanonicalHookName = "log-bash-event" | "invalidate-cache" | "session-start";

const HOOK_ALIASES: Record<string, CanonicalHookName> = {
  "log-bash-event": "log-bash-event",
  log_bash_event: "log-bash-event",
  "cursor-shell-event": "log-bash-event",
  cursor_shell_event: "log-bash-event",
  "invalidate-cache": "invalidate-cache",
  invalidate_cache: "invalidate-cache",
  "session-start": "session-start",
  session_start: "session-start",
};

export function normalizeHookName(name: string): CanonicalHookName | null {
  return HOOK_ALIASES[name] ?? null;
}

export type RunHookDeps = {
  repoRoot: string;
  env: NodeJS.ProcessEnv;
  readStdin: () => Promise<string>;
  writeStdout: (s: string) => void;
  writeStderr: (s: string) => void;
  invalidate?: (
    repoRoot: string,
    scope: string,
    env: NodeJS.ProcessEnv,
  ) => { scope: string; gen: { git: number; state: number } };
};

export async function runHook(
  rawName: string,
  args: string[],
  deps: RunHookDeps,
): Promise<number> {
  const name = normalizeHookName(rawName);
  if (!name) {
    deps.writeStderr(
      `Unknown hook: ${rawName || "<empty>"}\nAvailable: log-bash-event, invalidate-cache, session-start\n`,
    );
    return 1;
  }

  if (name === "log-bash-event") {
    const raw = await deps.readStdin();
    const paths = resolveLogBashPaths(deps.repoRoot, deps.env);
    const out = dispatchLogBashEventJson(raw, paths, deps.writeStderr);
    if (out !== null) deps.writeStdout(out);
    return 0;
  }

  if (name === "invalidate-cache") {
    const scope = args[0] ?? "state";
    const invalidate = deps.invalidate ?? invalidateMcpCache;
    const out = invalidate(deps.repoRoot, scope, deps.env);
    deps.writeStdout(`cache invalidated: scope=${out.scope} gen=${JSON.stringify(out.gen)}\n`);
    return 0;
  }

  const stateFile =
    deps.env.FLOWCTL_STATE_FILE?.trim() ||
    resolveStateFileForRepo(deps.repoRoot) ||
    `${deps.repoRoot}/flowctl-state.json`;
  const msg = buildSessionStartMessage(stateFile);
  if (msg) deps.writeStdout(`${msg}\n`);
  return 0;
}

export async function mainHookRunner(argv: string[]): Promise<void> {
  const hookName = argv[0] ?? "";
  const rest = argv.slice(1);
  const code = await runHook(hookName, rest, {
    repoRoot: process.cwd(),
    env: process.env,
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
  process.exitCode = code;
}

if (import.meta.main) {
  void mainHookRunner(process.argv.slice(2)).catch(() => {
    process.exitCode = 0;
  });
}

export { mainLogBashEvent };
