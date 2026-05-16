import { describe, expect, it } from "vitest";
import { collectStepRoles } from "@/commands/dispatch/roles";
import { makeState } from "../../../helpers/state";

describe("collectStepRoles", () => {
  it("returns empty when step is missing", () => {
    const state = makeState();
    expect(collectStepRoles(state, "99")).toEqual([]);
  });

  it("returns primary then support agents, deduped", () => {
    const state = makeState();
    const step1 = state.steps["1"]!;
    state.steps["1"] = {
      ...step1,
      agent: "pm",
      support_agents: ["tech-lead", "pm", "tech-lead"],
    };
    expect(collectStepRoles(state, "1")).toEqual(["pm", "tech-lead"]);
  });

  it("omits empty primary and trims roles", () => {
    const state = makeState();
    const step2 = state.steps["2"]!;
    state.steps["2"] = {
      ...step2,
      agent: "  backend  ",
      support_agents: ["", "tech-lead"],
    };
    expect(collectStepRoles(state, "2")).toEqual(["backend", "tech-lead"]);
  });
});
