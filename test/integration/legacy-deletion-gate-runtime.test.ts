/**
 * Encodes cleanup plan §1E runtime gate checklist (lines 122–126).
 * Coverage threshold is asserted when `coverage/coverage-summary.json` exists
 * (after `bun vitest run --coverage` or `flowctl legacy-deletion-gate --skip-run`).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEGACY_COVERAGE_THRESHOLDS,
  LARGE_LEGACY_DELETIONS,
  expandLegacyPaths,
  findSrcImportsOfLegacy,
  meetsCoverageThresholds,
  parseCoverageSummaryJson,
} from "@/cleanup/legacy-deletions";

const projectRoot = join(fileURLToPath(new URL("../..", import.meta.url)));

describe("legacy deletion gate runtime checklist", () => {
  it("(4) large legacy paths are not imported from src/", async () => {
    const hits = await findSrcImportsOfLegacy(projectRoot, expandLegacyPaths(LARGE_LEGACY_DELETIONS));
    expect(hits).toEqual([]);
  });

  it("(2) npx tsc --noEmit reports zero errors", async () => {
    const result = await execa("npx", ["tsc", "--noEmit"], {
      cwd: projectRoot,
      reject: false,
    });
    expect(result.exitCode, result.stderr || result.stdout).toBe(0);
  }, 120_000);

  it("(1) coverage summary meets lines/functions/branches thresholds", async () => {
    if (process.env.LEGACY_DELETION_GATE_STRICT !== "1") {
      return;
    }
    const summaryPath = join(projectRoot, "coverage", "coverage-summary.json");
    const raw = await readFile(summaryPath, "utf-8");
    const totals = parseCoverageSummaryJson(JSON.parse(raw));
    const verdict = meetsCoverageThresholds(totals, DEFAULT_LEGACY_COVERAGE_THRESHOLDS);
    expect(verdict.pass, verdict.detail).toBe(true);
  });
});
