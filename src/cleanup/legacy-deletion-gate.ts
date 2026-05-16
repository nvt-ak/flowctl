import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_LEGACY_COVERAGE_THRESHOLDS,
  LARGE_LEGACY_DELETIONS,
  expandLegacyPaths,
  findSrcImportsOfLegacy,
  meetsCoverageThresholds,
  parseCoverageSummaryJson,
  type CoverageTotals,
} from "@/cleanup/legacy-deletions";

export type GateCheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

export type LegacyDeletionGateResult = {
  pass: boolean;
  checks: GateCheckResult[];
  coverage?: CoverageTotals;
  srcImports?: { file: string; legacyPath: string }[];
};

export type LegacyDeletionGateRunner = () => Promise<void>;

export type EvaluateLegacyDeletionGateOptions = {
  projectRoot: string;
  coverageSummaryPath?: string;
  thresholds?: typeof DEFAULT_LEGACY_COVERAGE_THRESHOLDS;
  skipRun?: boolean;
  runTypecheck?: LegacyDeletionGateRunner;
  runUnitCoverage?: LegacyDeletionGateRunner;
  runIntegration?: LegacyDeletionGateRunner;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function checkCoverageFromSummary(
  summaryPath: string,
  thresholds: typeof DEFAULT_LEGACY_COVERAGE_THRESHOLDS,
): Promise<{ check: GateCheckResult; totals?: CoverageTotals }> {
  if (!(await fileExists(summaryPath))) {
    return {
      check: {
        name: "coverage",
        pass: false,
        detail: `missing ${summaryPath} — run: bun vitest run --coverage`,
      },
    };
  }
  try {
    const raw = JSON.parse(await readFile(summaryPath, "utf-8")) as unknown;
    const totals = parseCoverageSummaryJson(raw);
    const verdict = meetsCoverageThresholds(totals, thresholds);
    return {
      check: {
        name: "coverage",
        pass: verdict.pass,
        detail: verdict.pass ? verdict.detail : verdict.detail,
      },
      totals,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      check: {
        name: "coverage",
        pass: false,
        detail: `failed to read coverage summary: ${message}`,
      },
    };
  }
}

export async function evaluateLegacyDeletionGate(
  options: EvaluateLegacyDeletionGateOptions,
): Promise<LegacyDeletionGateResult> {
  const projectRoot = options.projectRoot;
  const summaryPath =
    options.coverageSummaryPath ?? join(projectRoot, "coverage", "coverage-summary.json");
  const thresholds = options.thresholds ?? DEFAULT_LEGACY_COVERAGE_THRESHOLDS;
  const checks: GateCheckResult[] = [];
  let coverage: CoverageTotals | undefined;
  let srcImports: { file: string; legacyPath: string }[] | undefined;

  if (!options.skipRun) {
    if (options.runTypecheck) {
      try {
        await options.runTypecheck();
        checks.push({ name: "typecheck", pass: true, detail: "tsc --noEmit OK" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({ name: "typecheck", pass: false, detail: message });
      }
    }
    if (options.runUnitCoverage) {
      try {
        await options.runUnitCoverage();
        checks.push({
          name: "vitest-coverage",
          pass: true,
          detail: "bun vitest run --coverage OK",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          name: "vitest-coverage",
          pass: false,
          detail: `bun vitest run --coverage failed: ${message}`,
        });
      }
    }
    if (options.runIntegration) {
      try {
        await options.runIntegration();
        checks.push({ name: "integration", pass: true, detail: "test/integration PASS" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({ name: "integration", pass: false, detail: message });
      }
    }
  }

  const cov = await checkCoverageFromSummary(summaryPath, thresholds);
  checks.push(cov.check);
  coverage = cov.totals;

  const legacyPaths = expandLegacyPaths(LARGE_LEGACY_DELETIONS);
  const hits = await findSrcImportsOfLegacy(projectRoot, legacyPaths);
  srcImports = hits;
  checks.push({
    name: "src-imports",
    pass: hits.length === 0,
    detail:
      hits.length === 0
        ? "no src/ imports of large legacy paths"
        : hits.map((h) => `${h.file} → ${h.legacyPath}`).join("; "),
  });

  const pass = checks.every((c) => c.pass);
  return { pass, checks, coverage, srcImports };
}
