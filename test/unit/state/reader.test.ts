import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readState, readStateOrDefault, getPath } from "@/state/reader";
import { defaultState } from "@/state/default-state";

describe("state/reader", () => {
  it("readState returns error when file missing", async () => {
    const r = await readState(join(tmpdir(), "nope-flowctl-state-xyz.json"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not found");
  });

  it("readState returns error on invalid JSON", async () => {
    const p = join(await mkdtemp(join(tmpdir(), "st-")), "s.json");
    await writeFile(p, "{", "utf-8");
    const r = await readState(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Invalid JSON");
  });

  it("readStateOrDefault returns default when file missing", async () => {
    const d = await readStateOrDefault(join(tmpdir(), "missing-state.json"));
    expect(d.project_name).toBeDefined();
  });

  it("getPath reads nested keys", () => {
    const s = defaultState();
    expect(getPath(s, "current_step")).toBe(s.current_step);
    expect(getPath(s, "steps.1.name")).toBeDefined();
    expect(getPath(s, "nope.nope")).toBeUndefined();
  });
});
