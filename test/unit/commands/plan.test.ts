import { describe, expect, it } from "vitest";
import { runPlan } from "@/commands/plan";

describe("commands/plan", () => {
  it("exports runPlan", () => {
    expect(typeof runPlan).toBe("function");
  });
});
