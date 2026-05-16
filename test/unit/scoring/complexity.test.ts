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

  it("returns 1 for unknown step", () => {
    const state = defaultState();
    expect(complexityScore(state, "999")).toBe(1);
    expect(complexityTier(1)).toBe("MICRO");
  });

  it("caps score at 5 and maps tier boundaries", () => {
    const state = defaultState();
    state.steps["4"] = {
      ...state.steps["4"]!,
      agent: "pm",
      support_agents: ["tech-lead", "backend", "frontend"],
      dispatch_risk: { high_risk: true, impacted_modules: 9, dispatch_count: 0 },
      blockers: [
        { id: "b", description: "x", created_at: "2026-01-01T00:00:00Z", resolved: false },
      ],
    };
    state.steps["1"] = {
      ...state.steps["1"]!,
      blockers: [
        {
          id: "prior",
          description: "y",
          created_at: "2026-01-01T00:00:00Z",
          resolved: false,
        },
      ],
    };

    const score = complexityScore(state, "4");
    expect(score).toBe(5);
    expect(complexityTier(score)).toBe("FULL");
    expect(complexityTier(2)).toBe("STANDARD");
    expect(complexityTier(3)).toBe("STANDARD");
  });

  it("warRoomThreshold falls back to env then default 4", () => {
    const state = defaultState();
    state.settings = {};
    expect(warRoomThreshold(state, "6")).toBe(6);
    expect(warRoomThreshold(state, "")).toBe(4);
  });
});
