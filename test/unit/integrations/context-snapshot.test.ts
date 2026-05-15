import { describe, expect, it } from "vitest";
import { defaultState } from "@/state/default-state";
import { buildContextSnapshot } from "@/integrations/context-snapshot";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("buildContextSnapshot", () => {
  it("includes step metadata and FRESH marker", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ctx-"));
    const state = defaultState();
    state.project_name = "Demo Project";
    state.steps["1"]!.status = "in_progress";

    const md = await buildContextSnapshot({
      state,
      step: "1",
      repoRoot: tmp,
      dispatchBase: join(tmp, "workflows", "dispatch"),
      generatedAt: new Date(),
    });

    expect(md).toContain("## Context Snapshot (Step 1:");
    expect(md).toContain("Demo Project");
    expect(md).toContain("**FRESH**");
    expect(md).toContain("dispatch_risk");
  });
});
