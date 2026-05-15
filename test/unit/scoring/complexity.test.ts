import { describe, expect, it } from "vitest";
import { defaultState } from "@/state/default-state";
import {
  complexityScore,
  complexityTier,
  warRoomThreshold,
} from "@/scoring/complexity";

describe("complexity scoring", () => {
  it("scores step with default agents", () => {
    const state = defaultState();
    const score = complexityScore(state, "1");
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(5);
    expect(["MICRO", "STANDARD", "FULL"]).toContain(complexityTier(score));
  });

  it("adds weight for high_risk and impacted_modules", () => {
    const state = defaultState();
    state.steps["4"] = {
      ...state.steps["4"]!,
      dispatch_risk: { high_risk: true, impacted_modules: 5, dispatch_count: 1 },
    };
    const score = complexityScore(state, "4");
    expect(score).toBeGreaterThanOrEqual(4);
    expect(complexityTier(score)).toBe("FULL");
  });

  it("warRoomThreshold prefers state settings", () => {
    const state = defaultState();
    state.settings = { war_room_threshold: 3 };
    expect(warRoomThreshold(state)).toBe(3);
    expect(warRoomThreshold(state, "5")).toBe(3);
  });
});
