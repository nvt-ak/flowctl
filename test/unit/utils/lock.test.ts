import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pathExists } from "@/utils/fs";
import {
  acquireFlowLock,
  checkIdempotency,
  withAdvisoryLock,
  withNamedDirLock,
} from "@/utils/lock";

const KEY = "step:1:role:pm:mode:headless";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function localTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

describe("withAdvisoryLock", () => {
  it("runs fn and releases lock on success", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-adv-"));
    const lockPath = join(dir, "state.lock");
    let ran = false;
    await withAdvisoryLock(lockPath, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(await pathExists(`${lockPath}.d`)).toBe(false);
  });

  it("throws after maxRetries when lock is held by a living process", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-adv-busy-"));
    const lockPath = join(dir, "busy.lock");
    const lockDir = `${lockPath}.d`;
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), String(process.pid), "utf-8");

    await expect(
      withAdvisoryLock(lockPath, async () => {}, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow(/Could not acquire advisory lock/);

    await rm(lockDir, { recursive: true, force: true });
  });

  it("waits and acquires after stale lock is reclaimed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-adv-reclaim-"));
    const lockPath = join(dir, "reclaim.lock");
    const lockDir = `${lockPath}.d`;
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), "999999", "utf-8");

    let ran = false;
    await withAdvisoryLock(
      lockPath,
      async () => {
        ran = true;
      },
      { maxRetries: 10, baseDelayMs: 1 },
    );
    expect(ran).toBe(true);
  });
});

describe("withNamedDirLock", () => {
  it("reclaims a stale dir lock and runs fn", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-dir-stale-"));
    const lockDir = join(dir, "flows.lock");
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), "999999", "utf-8");

    const value = await withNamedDirLock(
      lockDir,
      async () => "done",
      { maxRetries: 10, baseDelayMs: 1 },
    );
    expect(value).toBe("done");
  });

  it("does not reclaim when pid file has invalid or non-positive pid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-dir-bad-pid-"));
    const lockDir = join(dir, "bad-pid.lock");
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), "-1", "utf-8");

    await expect(
      withNamedDirLock(lockDir, async () => "x", { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow(/Could not acquire dir lock/);

    expect(await pathExists(lockDir)).toBe(true);
    await rm(lockDir, { recursive: true, force: true });
  });

  it("does not reclaim when lock holder pid is alive", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-dir-live-"));
    const lockDir = join(dir, "live.lock");
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), String(process.pid), "utf-8");

    await expect(
      withNamedDirLock(lockDir, async () => "x", { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow(/Could not acquire dir lock/);

    await rm(lockDir, { recursive: true, force: true });
  });

  it("serializes contenders via retry when lock is released", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-dir-contend-"));
    const lockDir = join(dir, "contend.lock");
    const order: string[] = [];

    const first = withNamedDirLock(
      lockDir,
      async () => {
        order.push("first-start");
        await sleep(40);
        order.push("first-end");
        return 1;
      },
      { maxRetries: 30, baseDelayMs: 2 },
    );

    await sleep(5);
    const second = withNamedDirLock(
      lockDir,
      async () => {
        order.push("second");
        return 2;
      },
      { maxRetries: 30, baseDelayMs: 2 },
    );

    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});

describe("acquireFlowLock", () => {
  it("throws when workflow lock is held by a living process", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flow-busy-"));
    const lockDir = join(dir, "workflow-busy.lock");
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), String(process.pid), "utf-8");

    await expect(acquireFlowLock(lockDir)).rejects.toThrow(
      /Workflow lock held by pid=/,
    );

    await rm(lockDir, { recursive: true, force: true });
  });

  it("returns release fn after acquiring", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flow-lock-"));
    const lockDir = join(dir, "workflow.lock");
    const release = await acquireFlowLock(lockDir);
    expect(await pathExists(lockDir)).toBe(true);
    await release();
    expect(await pathExists(lockDir)).toBe(false);
  });
});

describe("checkIdempotency", () => {
  it("SKIP when launched with a living pid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-skip-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launched", pid: process.pid },
      }),
      "utf-8",
    );

    const { decision, reason } = await checkIdempotency(idemFile, KEY, "worker-a");
    expect(decision).toBe("SKIP");
    expect(reason).toContain(`running pid=${process.pid}`);
  });

  it("SKIP when another dispatch is mid-launch (< 60s)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-launching-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launching", launching_at: localTimestamp() },
      }),
      "utf-8",
    );

    const { decision, reason } = await checkIdempotency(idemFile, KEY, "worker-b");
    expect(decision).toBe("SKIP");
    expect(reason).toContain("mid-launch");
  });

  it("LAUNCH when launching_at is invalid (treated as stale)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-bad-ts-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launching", launching_at: "not-a-valid-timestamp" },
      }),
      "utf-8",
    );

    const { decision, reason } = await checkIdempotency(idemFile, KEY, "worker-c");
    expect(decision).toBe("LAUNCH");
    expect(reason).toContain("stale launching state");
  });

  it("LAUNCH when launching state is older than 60s", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-old-launch-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launching", launching_at: "2020-01-01 00:00:00" },
      }),
      "utf-8",
    );

    const { decision, reason } = await checkIdempotency(idemFile, KEY, "worker-d");
    expect(decision).toBe("LAUNCH");
    expect(reason).toMatch(/stale launching state \(\d+s\)/);
  });

  it("LAUNCH when launched pid is dead (isProcessAlive false for pid<=0 paths)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-dead-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launched", pid: 999_999 },
      }),
      "utf-8",
    );

    const { decision } = await checkIdempotency(idemFile, KEY, "worker-e");
    expect(decision).toBe("LAUNCH");
  });

  it("LAUNCH when launched entry has pid -1 (non-positive pid not alive)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-pid-neg-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launched", pid: -1 },
      }),
      "utf-8",
    );

    const { decision } = await checkIdempotency(idemFile, KEY, "worker-f2");
    expect(decision).toBe("LAUNCH");
  });

  it("LAUNCH when launched entry has pid 0 (non-positive pid not alive)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-pid0-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: { status: "launched", pid: 0 },
      }),
      "utf-8",
    );

    const { decision } = await checkIdempotency(idemFile, KEY, "worker-f");
    expect(decision).toBe("LAUNCH");
  });

  it("LAUNCH on first run and writes launching_at timestamp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-first-"));
    const idemFile = join(dir, "idempotency.json");

    const { decision, reason } = await checkIdempotency(idemFile, KEY, "worker-g");
    expect(decision).toBe("LAUNCH");
    expect(reason).toContain("first launch");

    const data = JSON.parse(await readFile(idemFile, "utf-8")) as Record<
      string,
      { status?: string; launching_at?: string; _claimed_by?: string }
    >;
    expect(data[KEY]?.status).toBe("launching");
    expect(data[KEY]?._claimed_by).toBe("worker-g");
    expect(data[KEY]?.launching_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("SKIP when retry budget is exhausted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-retries-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({
        [KEY]: {
          status: "failed",
          retry_policy: { attempt_count: 3 },
        },
      }),
      "utf-8",
    );

    const { decision, reason } = await checkIdempotency(idemFile, KEY, "worker-i", {
      maxRetries: 3,
    });
    expect(decision).toBe("SKIP");
    expect(reason).toContain("retry budget exhausted");
  });

  it("SKIP when completed unless force-run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-done-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(
      idemFile,
      JSON.stringify({ [KEY]: { status: "completed" } }),
      "utf-8",
    );

    const skipped = await checkIdempotency(idemFile, KEY, "worker-h");
    expect(skipped.decision).toBe("SKIP");

    const forced = await checkIdempotency(idemFile, KEY, "worker-h", { forceRun: true });
    expect(forced.decision).toBe("LAUNCH");
  });

  it("exactly one LAUNCH under parallel subprocess contention", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(idemFile, "{}", "utf-8");
    const helper = join(import.meta.dirname, "../../helpers/idem-worker.ts");
    const n = 5;
    const outputs = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        new Promise<string>((resolve, reject) => {
          const child = spawn(
            "bun",
            ["run", helper, idemFile, KEY, `worker-${i}`],
            { stdio: ["ignore", "pipe", "pipe"] },
          );
          let out = "";
          let err = "";
          child.stdout?.on("data", (chunk) => {
            out += String(chunk);
          });
          child.stderr?.on("data", (chunk) => {
            err += String(chunk);
          });
          child.on("error", reject);
          child.on("close", (code) => {
            if (code !== 0) {
              reject(new Error(`worker-${i} exit ${code}: ${err || out}`));
              return;
            }
            resolve(out.trim());
          });
        }),
      ),
    );
    const launches = outputs.filter((o) => o.startsWith("LAUNCH"));
    const skips = outputs.filter((o) => o.startsWith("SKIP"));
    expect(launches).toHaveLength(1);
    expect(skips).toHaveLength(n - 1);
  }, 60_000);
});

describe("checkIdempotency lock contention", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for advisory lock then completes (lock held briefly)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-idem-wait-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(idemFile, "{}", "utf-8");
    const lockDir = `${idemFile}.lock.d`;
    await mkdir(lockDir);
    await writeFile(join(lockDir, "pid"), String(process.pid), "utf-8");

    const releaseTimer = setTimeout(() => {
      void rm(lockDir, { recursive: true, force: true });
    }, 40);

    try {
      const { decision } = await checkIdempotency(idemFile, KEY, "worker-wait", {
        maxRetries: 3,
      });
      expect(decision).toBe("LAUNCH");
    } finally {
      clearTimeout(releaseTimer);
      await rm(lockDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
