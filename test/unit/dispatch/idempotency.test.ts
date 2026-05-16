import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const KEY = "step:2:role:backend:mode:headless";

describe("dispatch idempotency (subprocess)", () => {
  it("stale idempotency.lock text file does not block LAUNCH", async () => {
    const dir = await mkdtemp(join(tmpdir(), "idem-stale-"));
    const idemFile = join(dir, "idempotency.json");
    await writeFile(idemFile, "{}", "utf-8");
    await writeFile(`${idemFile}.lock`, "dead-worker\n", "utf-8");

    const helper = join(import.meta.dirname, "../../helpers/idem-worker.ts");
    const out = await new Promise<string>((resolve, reject) => {
      const ch = spawn("bun", ["run", helper, idemFile, KEY, "fresh-worker"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "";
      let e = "";
      ch.stdout?.on("data", (d) => {
        o += String(d);
      });
      ch.stderr?.on("data", (d) => {
        e += String(d);
      });
      ch.on("error", reject);
      ch.on("close", (code) => {
        if (code !== 0) reject(new Error(e || o || `exit ${code}`));
        else resolve(o.trim());
      });
    });
    expect(out.startsWith("LAUNCH")).toBe(true);
  }, 60_000);
});
