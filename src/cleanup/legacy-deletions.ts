/**
 * Large legacy deletions registry (cleanup plan §1E).
 * Delete listed files only after `flowctl legacy-deletion-gate` passes.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export type LegacyDeletionCondition =
  | "coverage-95"
  | "phase-7-cutover"
  | "phase-8-port"
  | "phase-7-2-port"
  | "p0-p1-vitest-port";

export type LegacyDeletionEntry = {
  path: string;
  approxLines: number;
  conditions: LegacyDeletionCondition[];
};

/** Skill shims — logic lives in `src/skills/`. */
const SKILL_SHIMS = [
  "scripts/workflow/skills/skill-utils.mjs",
  "scripts/workflow/skills/build-index.mjs",
  "scripts/workflow/skills/lint-skill.mjs",
  "scripts/workflow/skills/list-skills.mjs",
  "scripts/workflow/skills/skill-loader.mjs",
  "scripts/workflow/skills/search-skills.mjs",
] as const;

export const LARGE_LEGACY_DELETIONS: readonly LegacyDeletionEntry[] = [
  {
    path: "scripts/workflow/mcp/shell-proxy.js",
    approxLines: 795,
    conditions: ["phase-7-cutover", "coverage-95"],
  },
  {
    path: "scripts/workflow/mcp/workflow-state.js",
    approxLines: 180,
    conditions: ["phase-7-cutover", "coverage-95"],
  },
  ...SKILL_SHIMS.map((path) => ({
    path,
    approxLines: 7,
    conditions: ["coverage-95"] as LegacyDeletionCondition[],
  })),
  {
    path: "scripts/hooks/setup-git-hooks.mjs",
    approxLines: 27,
    conditions: ["coverage-95"],
  },
  {
    path: "scripts/monitor-web.py",
    approxLines: 1453,
    conditions: ["phase-8-port", "coverage-95"],
  },
  {
    path: "scripts/setup.sh",
    approxLines: 279,
    conditions: ["phase-7-2-port", "coverage-95"],
  },
  {
    path: "tests/",
    approxLines: 3000,
    conditions: ["p0-p1-vitest-port", "coverage-95"],
  },
];

export function expandLegacyPaths(entries: readonly LegacyDeletionEntry[]): string[] {
  return entries.map((e) => e.path);
}

export type CoverageThresholds = {
  linesPct: number;
  functionsPct: number;
  branchesPct: number;
};

/** Gate checklist (cleanup plan §1E): lines/functions ≥ 95%, branches ≥ 90%. */
export const DEFAULT_LEGACY_COVERAGE_THRESHOLDS: CoverageThresholds = {
  linesPct: 95,
  functionsPct: 95,
  branchesPct: 90,
};

export type CoverageTotals = CoverageThresholds & { statementsPct: number };

type JsonSummaryMetric = { pct?: number };
type JsonSummaryFile = {
  total?: {
    lines?: JsonSummaryMetric;
    functions?: JsonSummaryMetric;
    branches?: JsonSummaryMetric;
    statements?: JsonSummaryMetric;
  };
};

export function parseCoverageSummaryJson(raw: unknown): CoverageTotals {
  const data = raw as JsonSummaryFile;
  const total = data.total;
  if (!total) {
    throw new Error("coverage-summary.json: missing total block");
  }
  const pct = (m: JsonSummaryMetric | undefined, label: string): number => {
    if (m?.pct === undefined || Number.isNaN(m.pct)) {
      throw new Error(`coverage-summary.json: missing ${label}.pct`);
    }
    return m.pct;
  };
  return {
    linesPct: pct(total.lines, "lines"),
    functionsPct: pct(total.functions, "functions"),
    branchesPct: pct(total.branches, "branches"),
    statementsPct: pct(total.statements, "statements"),
  };
}

export function meetsCoverageThresholds(
  totals: CoverageTotals,
  thresholds: CoverageThresholds,
): { pass: boolean; detail: string } {
  const parts: string[] = [];
  if (totals.linesPct < thresholds.linesPct) {
    parts.push(`lines ${totals.linesPct}% < ${thresholds.linesPct}%`);
  }
  if (totals.functionsPct < thresholds.functionsPct) {
    parts.push(`functions ${totals.functionsPct}% < ${thresholds.functionsPct}%`);
  }
  if (totals.branchesPct < thresholds.branchesPct) {
    parts.push(`branches ${totals.branchesPct}% < ${thresholds.branchesPct}%`);
  }
  if (parts.length === 0) {
    return {
      pass: true,
      detail: `lines ${totals.linesPct}%, functions ${totals.functionsPct}%, branches ${totals.branchesPct}%`,
    };
  }
  return { pass: false, detail: parts.join("; ") };
}

const IMPORT_LEGACY =
  /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

function importTargetsLegacy(specifier: string, legacyPaths: string[]): string | null {
  const normalized = specifier.replace(/^\.\//, "");
  for (const legacy of legacyPaths) {
    const base = legacy.replace(/\/$/, "");
    if (normalized === legacy || normalized === base) return legacy;
    if (normalized.includes(base)) return legacy;
    if (legacy.endsWith("/") && normalized.startsWith(legacy.slice(0, -1))) return legacy;
  }
  return null;
}

async function collectTsFiles(dir: string, root: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      await collectTsFiles(full, root, out);
    } else if (ent.isFile() && ent.name.endsWith(".ts")) {
      out.push(relative(root, full));
    }
  }
}

export type SrcLegacyImportHit = { file: string; legacyPath: string };

/** Returns src files that import any large legacy path (comments excluded). */
export async function findSrcImportsOfLegacy(
  projectRoot: string,
  legacyPaths: string[],
): Promise<SrcLegacyImportHit[]> {
  const srcDir = join(projectRoot, "src");
  const files: string[] = [];
  await collectTsFiles(srcDir, projectRoot, files);

  const hits: SrcLegacyImportHit[] = [];
  for (const file of files) {
    const content = await readFile(join(projectRoot, file), "utf-8");
    let match: RegExpExecArray | null;
    IMPORT_LEGACY.lastIndex = 0;
    while ((match = IMPORT_LEGACY.exec(content)) !== null) {
      const spec = match[1] ?? match[2] ?? match[3] ?? "";
      const legacy = importTargetsLegacy(spec, legacyPaths);
      if (legacy) {
        hits.push({ file, legacyPath: legacy });
        break;
      }
    }
  }
  return hits;
}
