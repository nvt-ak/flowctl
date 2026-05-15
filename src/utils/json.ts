import { readFile, rename, writeFile } from "node:fs/promises";
import type { z } from "zod";
import { withAdvisoryLock } from "@/utils/lock";
import { pathExists } from "@/utils/fs";

/** Atomic read-modify-write with advisory lock + temp rename. */
export async function atomicJsonWrite<T>(
  path: string,
  updater: (current: T) => T,
  schema: z.ZodSchema<T>,
  opts: { maxRetries?: number; baseDelayMs?: number } = {},
): Promise<void> {
  const lockPath = `${path}.lock`;
  await withAdvisoryLock(
    lockPath,
    async () => {
      let current: T;
      if (await pathExists(path)) {
        const raw = JSON.parse(await readFile(path, "utf-8"));
        current = schema.parse(raw);
      } else {
        throw new Error(`atomicJsonWrite: file does not exist: ${path}`);
      }
      const updated = schema.parse(updater(current));
      const tmp = `${path}.tmp.${process.pid}`;
      await writeFile(tmp, JSON.stringify(updated, null, 2), "utf-8");
      await rename(tmp, path);
    },
    { maxRetries: opts.maxRetries ?? 40, baseDelayMs: opts.baseDelayMs ?? 25 },
  );
}
