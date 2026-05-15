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
});
