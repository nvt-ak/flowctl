import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultState } from "@/state/default-state";
import { collectFromReports } from "@/integrations/report-collect";

describe("collectFromReports", () => {
  it("returns noReports when reports dir is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-collect-"));
    const reportsDir = join(root, "reports");
    await mkdir(reportsDir, { recursive: true });
    const state = defaultState();
    const result = collectFromReports({
      state,
      step: "1",
      repoRoot: root,
      reportsDir,
    });
    expect(result.noReports).toBe(true);
  });

  it("parses DECISION and BLOCKER lines from reports", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-collect-"));
    const reportsDir = join(root, ".flowctl", "dispatch", "step-1", "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      join(reportsDir, "backend-report.md"),
      [
        "# Report",
        "DECISION: Use JWT for auth",
        "- BLOCKER: API contract missing",
        "BLOCKER: NONE",
      ].join("\n"),
      "utf-8",
    );
    const state = defaultState();
    const result = collectFromReports({
      state,
      step: "1",
      repoRoot: root,
      reportsDir,
    });
    expect(result.noReports).toBe(false);
    expect(result.newDecisions).toBe(1);
    expect(result.newBlockers).toBe(1);
    expect(state.steps["1"]?.decisions).toHaveLength(1);
    expect(state.steps["1"]?.blockers).toHaveLength(1);
  });

  it("marks unverified DELIVERABLE when file missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-collect-"));
    const reportsDir = join(root, "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      join(reportsDir, "qa-report.md"),
      "DELIVERABLE: src/missing.ts — implementation",
      "utf-8",
    );
    const state = defaultState();
    const result = collectFromReports({
      state,
      step: "1",
      repoRoot: root,
      reportsDir,
    });
    expect(result.newUnverified).toBe(1);
    const d = state.steps["1"]?.deliverables?.find(
      (x) => typeof x === "object" && x !== null && "verified" in x,
    );
    expect(d).toMatchObject({ verified: false, path: "src/missing.ts" });
  });

  it("parses SUGGESTED_SKIP with pipe and em-dash separators", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-collect-skip-"));
    const reportsDir = join(root, "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      join(reportsDir, "pm-report.md"),
      [
        "SUGGESTED_SKIP: 3 | skip UI for API-only",
        "- SUGGESTED_SKIP: 5 — no frontend work",
        "SUGGESTED_SKIP: 3 | duplicate ignored",
      ].join("\n"),
      "utf-8",
    );
    const state = defaultState();
    const result = collectFromReports({
      state,
      step: "1",
      repoRoot: root,
      reportsDir,
    });
    expect(result.suggestedSkips).toHaveLength(2);
    expect(result.suggestedSkips[0]).toMatchObject({
      step: 3,
      reason: "skip UI for API-only",
    });
    expect(result.suggestedSkips[1]).toMatchObject({
      step: 5,
      reason: "no frontend work",
    });
  });

  it("throws when step is missing from state", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-collect-step-"));
    const reportsDir = join(root, "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(join(reportsDir, "x-report.md"), "# ok\n", "utf-8");
    const state = defaultState();
    delete state.steps["9"];
    expect(() =>
      collectFromReports({
        state,
        step: "9",
        repoRoot: root,
        reportsDir,
      }),
    ).toThrow("Step 9 missing in state");
  });
});
