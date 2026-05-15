import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathExists } from "@/utils/fs";

export type LockOpts = { maxRetries?: number; baseDelayMs?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse bash/Python `YYYY-MM-DD HH:MM:SS` in local time (parity with idem_check.py). */
function launchedAtAgeSeconds(launchedAt: string): number {
  const m = launchedAt.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return 999;
  const launched = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  ).getTime();
  return (Date.now() - launched) / 1000;
}

function formatLocalTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function tryAcquireDirLock(lockDir: string): Promise<boolean> {
  try {
    await mkdir(lockDir, { recursive: false });
    await writeFile(join(lockDir, "pid"), String(process.pid), "utf-8");
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
    return false;
  }
}

async function reclaimStaleDirLock(lockDir: string): Promise<boolean> {
  const pidFile = join(lockDir, "pid");
  let holder = "unknown";
  try {
    holder = (await readFile(pidFile, "utf-8")).trim();
  } catch {
    /* empty */
  }

  // Do not steal locks with missing/invalid pid — holder may still be starting up.
  if (!/^[1-9]\d*$/.test(holder)) {
    return false;
  }
  if (isProcessAlive(Number(holder))) {
    return false;
  }

  try {
    await rm(lockDir, { recursive: true, force: true });
  } catch {
    return false;
  }
  return tryAcquireDirLock(lockDir);
}

/** Lock using `lockDir` as the directory path (bash `flows.new.lock` parity). */
export async function withNamedDirLock<T>(
  lockDir: string,
  fn: () => Promise<T>,
  opts: LockOpts = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 40;
  const baseDelayMs = opts.baseDelayMs ?? 25;
  let result!: T;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (
      (await tryAcquireDirLock(lockDir)) ||
      (await reclaimStaleDirLock(lockDir))
    ) {
      try {
        result = await fn();
      } finally {
        await rm(lockDir, { recursive: true, force: true });
      }
      return result;
    }
    await sleep(baseDelayMs * 0.1 + Math.random() * 9);
  }

  throw new Error(
    `Could not acquire dir lock after ${maxRetries} attempts: ${lockDir}`,
  );
}

/** Serialize critical sections (state / idempotency) via mkdir lock dir. */
export async function withAdvisoryLock(
  lockPath: string,
  fn: () => Promise<void>,
  opts: LockOpts = {},
): Promise<void> {
  const maxRetries = opts.maxRetries ?? 8;
  const baseDelayMs = opts.baseDelayMs ?? 50;
  const lockDir = `${lockPath}.d`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if ((await tryAcquireDirLock(lockDir)) || (await reclaimStaleDirLock(lockDir))) {
      try {
        await fn();
      } finally {
        await rm(lockDir, { recursive: true, force: true });
      }
      return;
    }
    const jitter = Math.random() * 10;
    await sleep(baseDelayMs * 2 ** attempt + jitter);
  }

  throw new Error(
    `Could not acquire advisory lock after ${maxRetries} attempts: ${lockPath}`,
  );
}

/** Workflow-level lock (mkdir + pid file), matching lock.sh semantics. */
export async function acquireFlowLock(
  lockDir: string,
): Promise<() => Promise<void>> {
  const maxRetries = 8;
  const baseDelayMs = 50;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if ((await tryAcquireDirLock(lockDir)) || (await reclaimStaleDirLock(lockDir))) {
      return async () => {
        await rm(lockDir, { recursive: true, force: true });
      };
    }
    await sleep(baseDelayMs * 2 ** attempt);
  }

  const pidFile = join(lockDir, "pid");
  let holder = "unknown";
  try {
    holder = (await readFile(pidFile, "utf-8")).trim();
  } catch {
    /* empty */
  }
  throw new Error(
    `Workflow lock held by pid=${holder}. Retry later or use flowctl fork.`,
  );
}

export type IdempotencyDecision = "LAUNCH" | "SKIP" | "WAIT";

export type IdempotencyEntry = {
  status?: string;
  pid?: number;
  launching_at?: string;
  retry_policy?: { attempt_count?: number };
  _claimed_by?: string;
};

/** Port of tests/helpers/idem_check.py — LAUNCH | SKIP decision. */
export async function checkIdempotency(
  file: string,
  key: string,
  workerId: string,
  opts: {
    forceRun?: boolean;
    maxRetries?: number;
  } = {},
): Promise<{ decision: IdempotencyDecision; reason: string }> {
  const forceRun = opts.forceRun ?? false;
  const maxRetries = opts.maxRetries ?? 3;
  const lockPath = `${file}.lock`;
  let result: { decision: IdempotencyDecision; reason: string } = {
    decision: "SKIP",
    reason: "unknown",
  };

  await withAdvisoryLock(
    lockPath,
    async () => {
      let data: Record<string, IdempotencyEntry> = {};
      if (await pathExists(file)) {
        data = JSON.parse(await readFile(file, "utf-8")) as Record<
          string,
          IdempotencyEntry
        >;
      }

      const entry = data[key] ?? {};
      const status = entry.status ?? "";
      const pid = entry.pid;
      const attemptCount = entry.retry_policy?.attempt_count ?? 0;
      let running = false;
      if (typeof pid === "number" && pid > 0) {
        running = isProcessAlive(pid);
      }

      let decisionLine: string;
      if (forceRun) {
        decisionLine = `LAUNCH|force-run enabled|prev_status=${status || "none"}`;
      } else if (status === "launched" && running) {
        decisionLine = `SKIP|already launched with running pid=${pid}`;
      } else if (status === "launching") {
        const launchedAt = entry.launching_at ?? "";
        const age = launchedAt ? launchedAtAgeSeconds(launchedAt) : 999;
        if (age < 60) {
          decisionLine =
            "SKIP|another dispatch is mid-launch (launching state < 60s old)";
        } else {
          decisionLine = `LAUNCH|stale launching state (${Math.floor(age)}s); retrying`;
        }
      } else if (status === "completed") {
        decisionLine = "SKIP|already completed; use --force-run to rerun";
      } else if (attemptCount >= maxRetries) {
        decisionLine = `SKIP|retry budget exhausted (${attemptCount}/${maxRetries}); use --force-run`;
      } else {
        const reason = !status ? "first launch" : `resume from status=${status}`;
        decisionLine = `LAUNCH|${reason}`;
      }

      if (decisionLine.startsWith("LAUNCH")) {
        const ts = formatLocalTimestamp();
        data[key] = {
          ...entry,
          status: "launching",
          launching_at: ts,
          _claimed_by: workerId,
        };
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(data, null, 2), "utf-8");
        result = { decision: "LAUNCH", reason: decisionLine };
      } else {
        result = {
          decision: decisionLine.startsWith("WAIT") ? "WAIT" : "SKIP",
          reason: decisionLine,
        };
      }
    },
    { maxRetries: 40, baseDelayMs: 25 },
  );

  return result;
}
