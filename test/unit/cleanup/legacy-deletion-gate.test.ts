import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEGACY_COVERAGE_THRESHOLDS,
  LARGE_LEGACY_DELETIONS,
  expandLegacyPaths,
  findSrcImportsOfLegacy,
  meetsCoverageThresholds,
  parseCoverageSummaryJson,
  type CoverageTotals,
} from "@/cleanup/legacy-deletions";
import { evaluateLegacyDeletionGate } from "@/cleanup/legacy-deletion-gate";

describe("legacy-deletions registry", () => {
  it("lists all large legacy files from cleanup plan 1E", () => {
    const paths = expandLegacyPaths(LARGE_LEGACY_DELETIONS);
    expect(paths).toContain("scripts/workflow/mcp/shell-proxy.js");
    expect(paths).toContain("scripts/workflow/mcp/workflow-state.js");
    expect(paths).toContain("scripts/monitor-web.py");
    expect(paths).toContain("scripts/setup.sh");
    expect(paths.filter((p) => p.startsWith("scripts/workflow/skills/") && p.endsWith(".mjs"))).toHaveLength(6);
    expect(paths).toContain("scripts/hooks/setup-git-hooks.mjs");
    expect(paths).toContain("tests/");
  });
});

describe("parseCoverageSummaryJson", () => {
  it("reads vitest json-summary total block", () => {
    const summary = {
      total: {
        lines: { total: 100, covered: 96, skipped: 0, pct: 96 },
        functions: { total: 50, covered: 48, skipped: 0, pct: 96 },
        branches: { total: 80, covered: 72, skipped: 0, pct: 90 },
        statements: { total: 120, covered: 114, skipped: 0, pct: 95 },
      },
    };
    expect(parseCoverageSummaryJson(summary)).toEqual({
      linesPct: 96,
      functionsPct: 96,
      branchesPct: 90,
      statementsPct: 95,
    });
  });
});

describe("meetsCoverageThresholds", () => {
  const thresholds = DEFAULT_LEGACY_COVERAGE_THRESHOLDS;

  it("passes when lines, functions, branches meet gate", () => {
    const totals: CoverageTotals = { linesPct: 95, functionsPct: 95, branchesPct: 90, statementsPct: 95 };
    const result = meetsCoverageThresholds(totals, thresholds);
    expect(result.pass).toBe(true);
  });

  it("fails when branches below 90%", () => {
    const totals: CoverageTotals = { linesPct: 96, functionsPct: 96, branchesPct: 89, statementsPct: 96 };
    const result = meetsCoverageThresholds(totals, thresholds);
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/branches/i);
  });
});

describe("findSrcImportsOfLegacy", () => {
  it("detects import from scripts/ in src", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-import-"));
    await mkdir(join(root, "src", "foo"), { recursive: true });
    await writeFile(
      join(root, "src", "foo", "bad.ts"),
      `import x from "../../scripts/workflow/mcp/shell-proxy.js";\n`,
      "utf-8",
    );
    await writeFile(join(root, "src", "ok.ts"), `// scripts/workflow/mcp/shell-proxy.js parity only\n`, "utf-8");

    const hits = await findSrcImportsOfLegacy(root, ["scripts/workflow/mcp/shell-proxy.js"]);
    expect(hits).toEqual([{ file: "src/foo/bad.ts", legacyPath: "scripts/workflow/mcp/shell-proxy.js" }]);
  });
});

describe("evaluateLegacyDeletionGate", () => {
  it("passes when all checks succeed", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-gate-"));
    await mkdir(join(root, "coverage"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 95 },
          functions: { pct: 95 },
          branches: { pct: 90 },
          statements: { pct: 95 },
        },
      }),
      "utf-8",
    );

    const result = await evaluateLegacyDeletionGate({
      projectRoot: root,
      coverageSummaryPath: join(root, "coverage", "coverage-summary.json"),
      runTypecheck: async () => {},
      runUnitCoverage: async () => {},
      runIntegration: async () => {},
    });

    expect(result.pass).toBe(true);
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });

  it("fails when coverage summary missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-gate-miss-"));
    const result = await evaluateLegacyDeletionGate({
      projectRoot: root,
      coverageSummaryPath: join(root, "coverage", "coverage-summary.json"),
      runTypecheck: async () => {},
      runUnitCoverage: async () => {},
      runIntegration: async () => {},
    });
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "coverage")?.pass).toBe(false);
  });
});
