import { describe, expect, it } from "vitest";
import {
  normalizeShadowStream,
  stableSortKeys,
  workflowStateJsonEquivalent,
} from "@/distribution/shadow-normalize";

describe("distribution/shadow-normalize", () => {
  it("stripAnsi + timestamps + flowctl prefix (normalizeShadowStream)", () => {
    const raw =
      "\u001b[31m[flowctl]\u001b[0m at 2026-05-16T10:00:00.123Z done\n" +
      "\u001b[32mok\u001b[0m  \n";
    const out = normalizeShadowStream(raw);
    expect(out).not.toContain("\x1b");
    expect(out).not.toContain("\u001b[");
    expect(out).toContain("<TIMESTAMP>");
    expect(out).not.toContain("[flowctl]");
  });

  it("stableSortKeys sorts object keys recursively without reordering arrays", () => {
    const input = {
      zebra: 1,
      apple: { y: 2, x: 3 },
      list: [{ b: 1, a: 2 }, 9],
    };
    const sorted = stableSortKeys(input) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(["apple", "list", "zebra"]);
    expect(Object.keys(sorted.apple as object)).toEqual(["x", "y"]);
    expect((sorted.list as unknown[])[0]).toEqual({ a: 2, b: 1 });
    expect((sorted.list as unknown[])[1]).toBe(9);
  });

  it("workflowStateJsonEquivalent ignores key order between stringify variants", () => {
    const a = JSON.stringify({ b: 1, a: { z: 0, m: 1 } });
    const b = JSON.stringify({ a: { m: 1, z: 0 }, b: 1 });
    expect(workflowStateJsonEquivalent(a, b)).toBe(true);
  });

  it("workflowStateJsonEquivalent preserves semantic array order (blockers)", () => {
    const a = JSON.stringify({
      blockers: [{ id: "a", created_at: "1" }, { id: "b", created_at: "2" }],
    });
    const b = JSON.stringify({
      blockers: [{ id: "b", created_at: "2" }, { id: "a", created_at: "1" }],
    });
    expect(workflowStateJsonEquivalent(a, b)).toBe(false);
  });

  it("workflowStateJsonEquivalent returns false on invalid JSON", () => {
    expect(workflowStateJsonEquivalent("{", "{}")).toBe(false);
  });
});
