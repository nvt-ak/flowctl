import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkIdempotency } from "@/utils/lock";

describe("checkIdempotency", () => {
  const KEY = "step:1:role:pm:mode:headless";

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
