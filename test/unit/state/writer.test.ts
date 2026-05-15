import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readState } from "@/state/reader";
import { appendPath, initStateFile, setPath } from "@/state/writer";

describe("state writer", () => {
  it("setPath updates dot-path steps.1.status", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-"));
    const stateFile = join(dir, "state.json");
    await initStateFile(stateFile);
    await setPath(stateFile, "steps.1.status", "in_progress");
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.steps["1"]?.status).toBe("in_progress");
    }
  });

  it("appendPath appends to steps.1.blockers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-"));
    const stateFile = join(dir, "state.json");
    await initStateFile(stateFile);
    const blocker = {
      id: "b1",
      description: "test",
      created_at: "2026-01-01",
      resolved: false,
    };
    await appendPath(stateFile, "steps.1.blockers", blocker);
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.steps["1"]?.blockers).toHaveLength(1);
      expect(result.data.steps["1"]?.blockers[0]?.id).toBe("b1");
    }
  });

  it(
    "10 concurrent subprocess setPath — valid JSON, no corruption",
    async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-conc-"));
    const stateFile = join(dir, "state.json");
    await initStateFile(stateFile);
    const helper = join(import.meta.dirname, "../../helpers/concurrent-set-path.ts");
    const n = 10;
    const exits = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        new Promise<number>((resolve, reject) => {
          const child = spawn("bun", ["run", helper, stateFile, String(i)], {
            stdio: "inherit",
          });
          child.on("error", reject);
          child.on("close", (code) => resolve(code ?? 1));
        }),
      ),
    );
    expect(exits.every((c) => c === 0)).toBe(true);
    const raw = await readFile(stateFile, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    },
    60_000,
  );
});
