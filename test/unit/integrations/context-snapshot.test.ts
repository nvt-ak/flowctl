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

  it("uses defaults when dispatch_risk is absent", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ctx-risk-"));
    const state = defaultState();
    delete state.steps["1"]!.dispatch_risk;

    const md = await buildContextSnapshot({
      state,
      step: "1",
      repoRoot: tmp,
      dispatchBase: join(tmp, "workflows", "dispatch"),
      generatedAt: new Date(),
    });

    expect(md).toContain("(defaults — no PM risk flags set)");
  });

  it("handles missing step key with empty metadata", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ctx-miss-"));
    const state = defaultState();
    delete state.steps["99"];

    const md = await buildContextSnapshot({
      state,
      step: "99",
      repoRoot: tmp,
      dispatchBase: join(tmp, "workflows", "dispatch"),
      generatedAt: new Date(Date.now() - 60 * 60_000),
    });

    expect(md).toContain("## Context Snapshot (Step 99:");
    expect(md).toContain("**⚠ STALE**");
    expect(md).toContain("(none recorded on this step)");
    expect(md).toContain("| Status |  |");
    expect(md).toContain("| Primary | `` |");
  });
});
