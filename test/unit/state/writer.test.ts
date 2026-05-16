import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPath, readState } from "@/state/reader";
import * as writer from "@/state/writer";
import { defaultState } from "@/state/default-state";
import {
  appendPath,
  initStateFile,
  setPath,
  writeState,
} from "@/state/writer";

describe("state writer", () => {
  it("does not export getPathFromFile (use readState + getPath from reader)", () => {
    expect(writer).not.toHaveProperty("getPathFromFile");
  });

  it("readState + getPath reads dot-path from state file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-"));
    const stateFile = join(dir, "state.json");
    await initStateFile(stateFile);
    await setPath(stateFile, "steps.1.status", "in_progress");
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getPath(result.data, "steps.1.status")).toBe("in_progress");
      expect(getPath(result.data, "missing.path")).toBeUndefined();
    }
  });

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

  it("setPath creates state file when missing (mkdir -p)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-mkdir-"));
    const stateFile = join(dir, "nested", "dir", "state.json");
    await setPath(stateFile, "current_step", 2);
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.current_step).toBe(2);
    }
  });

  it("appendPath creates array at missing leaf then merges further appends", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-append-"));
    const stateFile = join(dir, "state.json");
    await initStateFile(stateFile);
    const first = {
      id: "b1",
      description: "one",
      created_at: "2026-01-01",
      resolved: false,
    };
    const second = {
      id: "b2",
      description: "two",
      created_at: "2026-01-02",
      resolved: false,
    };
    await appendPath(stateFile, "steps.2.blockers", first);
    await appendPath(stateFile, "steps.2.blockers", second);
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.steps["2"]?.blockers).toEqual([first, second]);
    }
  });

  it("appendPath initializes missing state file then appends", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-append-init-"));
    const stateFile = join(dir, "deep", "state.json");
    const blocker = {
      id: "b-init",
      description: "init path",
      created_at: "2026-01-01",
      resolved: false,
    };
    await appendPath(stateFile, "steps.1.blockers", blocker);
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.steps["1"]?.blockers).toHaveLength(1);
      expect(result.data.steps["1"]?.blockers[0]?.id).toBe("b-init");
    }
  });

  it("writeState creates parent directories and writes validated state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-write-"));
    const stateFile = join(dir, "a", "b", "state.json");
    const state = defaultState();
    state.current_step = 3;
    await writeState(stateFile, state);
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.current_step).toBe(3);
    }
  });

  it("initStateFile is idempotent when file already exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-writer-init-"));
    const stateFile = join(dir, "state.json");
    await initStateFile(stateFile);
    await setPath(stateFile, "current_step", 9);
    await initStateFile(stateFile);
    const result = await readState(stateFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.current_step).toBe(9);
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
