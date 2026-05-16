import { describe, expect, it } from "vitest";
import * as dotPath from "@/utils/dot-path";
import { appendAtPath, setAtPath } from "@/utils/dot-path";

describe("dot-path utils", () => {
  it("does not export getAtPath (use state/reader getPath for reads)", () => {
    expect(dotPath).not.toHaveProperty("getAtPath");
  });

  it("setAtPath creates nested objects and sets leaf value", () => {
    const root: Record<string, unknown> = {};
    setAtPath(root, "steps.1.status", "in_progress");
    expect(root).toEqual({
      steps: { "1": { status: "in_progress" } },
    });
  });

  it("setAtPath overwrites existing leaf", () => {
    const root: Record<string, unknown> = {
      steps: { "1": { status: "pending" } },
    };
    setAtPath(root, "steps.1.status", "done");
    expect((root.steps as Record<string, unknown>)["1"]).toEqual({
      status: "done",
    });
  });

  it("setAtPath replaces null intermediate with object and nests", () => {
    const root: Record<string, unknown> = { steps: null };
    setAtPath(root, "steps.1.status", "in_progress");
    expect(root).toEqual({
      steps: { "1": { status: "in_progress" } },
    });
  });

  it("setAtPath replaces scalar intermediate with object and nests", () => {
    const root: Record<string, unknown> = { steps: "legacy" };
    setAtPath(root, "steps.1.status", "in_progress");
    expect(root).toEqual({
      steps: { "1": { status: "in_progress" } },
    });
  });

  it("appendAtPath pushes onto existing array", () => {
    const root: Record<string, unknown> = {
      steps: { "1": { blockers: [{ id: "a" }] } },
    };
    appendAtPath(root, "steps.1.blockers", { id: "b" });
    const blockers = (
      (root.steps as Record<string, unknown>)["1"] as Record<string, unknown>
    ).blockers as unknown[];
    expect(blockers).toHaveLength(2);
    expect(blockers[1]).toEqual({ id: "b" });
  });

  it("appendAtPath creates array when path segment is missing", () => {
    const root: Record<string, unknown> = { steps: { "1": {} } };
    appendAtPath(root, "steps.1.blockers", { id: "first" });
    const blockers = (
      (root.steps as Record<string, unknown>)["1"] as Record<string, unknown>
    ).blockers as unknown[];
    expect(blockers).toEqual([{ id: "first" }]);
  });

  it("appendAtPath wraps scalar into array when segment exists but is not array", () => {
    const root: Record<string, unknown> = {
      steps: { "1": { blockers: { id: "solo" } } },
    };
    appendAtPath(root, "steps.1.blockers", { id: "next" });
    const blockers = (
      (root.steps as Record<string, unknown>)["1"] as Record<string, unknown>
    ).blockers as unknown[];
    expect(blockers).toEqual([{ id: "solo" }, { id: "next" }]);
  });

  it("appendAtPath throws when intermediate path is missing", () => {
    const root: Record<string, unknown> = {};
    expect(() => appendAtPath(root, "steps.1.blockers", { id: "x" })).toThrow(
      /Invalid append path/,
    );
  });

  it("appendAtPath throws when intermediate segment is null", () => {
    const root: Record<string, unknown> = { steps: null };
    expect(() => appendAtPath(root, "steps.1.blockers", { id: "x" })).toThrow(
      /Invalid append path/,
    );
  });
});
