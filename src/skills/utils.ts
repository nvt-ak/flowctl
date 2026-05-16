/**
 * Skills catalog helpers — TypeScript port of scripts/workflow/skills/skill-utils.mjs (Phase 5).
 * Run skill scripts with Bun (see shebang on *.mjs in scripts/workflow/skills/).
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REQUIRED_FIELDS = [
  "name",
  "description",
  "triggers",
  "when-to-use",
  "when-not-to-use",
  "estimated-tokens",
  "version",
] as const;

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseScalar(raw: string): string | number | boolean {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return stripQuotes(value);
}

function parseArray(raw: string): string[] | null {
  const value = raw.trim();
  if (!value.startsWith("[") || !value.endsWith("]")) return null;
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}

export type ParsedFrontmatter = {
  data: Record<string, unknown>;
  body: string;
  lineMap: Record<string, number>;
};

export function parseFrontmatter(content: string, filePath: string): ParsedFrontmatter {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new Error(`Missing frontmatter start in ${filePath}`);
  }

  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error(`Missing frontmatter end in ${filePath}`);
  }

  const data: Record<string, unknown> = {};
  const lineMap: Record<string, number> = {};

  for (let i = 1; i < end; i += 1) {
    const line = lines[i] ?? "";
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    lineMap[key] = i + 1;

    const arr = parseArray(rawValue);
    if (arr !== null) {
      data[key] = arr;
    } else {
      data[key] = parseScalar(rawValue);
    }
  }

  const body = lines.slice(end + 1).join("\n");
  return { data, body, lineMap };
}

export type SkillIssue = {
  file: string;
  line: number;
  severity: "error" | "warn";
  message: string;
  suggestion?: string;
};

export function validateFrontmatter(
  frontmatter: Record<string, unknown>,
  filePath: string,
  lineMap: Record<string, number>,
  seenNames: Set<string> = new Set(),
): SkillIssue[] {
  const issues: SkillIssue[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter)) {
      issues.push({
        file: filePath,
        line: 1,
        severity: "error",
        message: `Missing required field '${field}'`,
        suggestion: `Add '${field}' to frontmatter.`,
      });
    }
  }

  if (typeof frontmatter.name === "string") {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(frontmatter.name)) {
      issues.push({
        file: filePath,
        line: lineMap.name ?? 1,
        severity: "error",
        message: `Invalid name '${frontmatter.name}' (must be kebab-case).`,
        suggestion: "Use lowercase kebab-case, e.g. code-review.",
      });
    }
    if (seenNames.has(frontmatter.name)) {
      issues.push({
        file: filePath,
        line: lineMap.name ?? 1,
        severity: "error",
        message: `Duplicate skill name '${frontmatter.name}'.`,
        suggestion: "Use a unique skill name.",
      });
    }
  }

  if (typeof frontmatter.description !== "string" || !frontmatter.description.trim()) {
    issues.push({
      file: filePath,
      line: lineMap.description ?? 1,
      severity: "error",
      message: "description must be a non-empty string.",
      suggestion: "Add a one-line description (<120 chars).",
    });
  } else if (frontmatter.description.length > 120) {
    issues.push({
      file: filePath,
      line: lineMap.description ?? 1,
      severity: "error",
      message: "description must be <= 120 chars.",
      suggestion: "Shorten the description.",
    });
  }

  if (
    !Array.isArray(frontmatter.triggers) ||
    frontmatter.triggers.length < 3 ||
    frontmatter.triggers.some((x) => typeof x !== "string" || !String(x).trim())
  ) {
    issues.push({
      file: filePath,
      line: lineMap.triggers ?? 1,
      severity: "error",
      message: "triggers must be an array of >=3 non-empty strings.",
      suggestion: 'Example: triggers: ["bug", "error", "regression"]',
    });
  }

  for (const field of ["when-to-use", "when-not-to-use"] as const) {
    if (typeof frontmatter[field] !== "string" || !String(frontmatter[field]).trim()) {
      issues.push({
        file: filePath,
        line: lineMap[field] ?? 1,
        severity: "error",
        message: `${field} must be a non-empty string.`,
        suggestion: `Add a short guidance sentence for ${field}.`,
      });
    }
  }

  const est = frontmatter["estimated-tokens"];
  if (!Number.isFinite(est) || typeof est !== "number" || est <= 0) {
    issues.push({
      file: filePath,
      line: lineMap["estimated-tokens"] ?? 1,
      severity: "error",
      message: "estimated-tokens must be a positive number.",
      suggestion: "Estimate token count from body size (chars/4).",
    });
  }

  if (typeof frontmatter.version !== "string" || !/^\d+\.\d+\.\d+$/.test(frontmatter.version)) {
    issues.push({
      file: filePath,
      line: lineMap.version ?? 1,
      severity: "error",
      message: "version must be semver (e.g. 1.0.0).",
      suggestion: 'Set version: "1.0.0".',
    });
  }

  for (const arrKey of ["roles-suggested", "tags", "prerequisites"] as const) {
    if (arrKey in frontmatter) {
      const v = frontmatter[arrKey];
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
        issues.push({
          file: filePath,
          line: lineMap[arrKey] ?? 1,
          severity: "error",
          message: `${arrKey} must be an array of strings.`,
          suggestion: `Example: ${arrKey}: ["backend", "qa"]`,
        });
      }
    }
  }

  return issues;
}

function walk(dir: string, out: string[]): void {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
    } else if (entry === "SKILL.md") {
      out.push(abs);
    }
  }
}

export function getProjectRoot(args: string[] = process.argv.slice(2)): string {
  const idx = args.indexOf("--project-root");
  if (idx >= 0 && args[idx + 1]) {
    return resolve(args[idx + 1]!);
  }
  if (process.env.FLOWCTL_PROJECT_ROOT) {
    return resolve(process.env.FLOWCTL_PROJECT_ROOT);
  }
  return resolve(process.cwd());
}

export function getSkillsRoot(projectRoot: string): string {
  return join(projectRoot, ".cursor", "skills");
}

export function discoverSkillFiles(projectRoot: string): string[] {
  const skillsRoot = getSkillsRoot(projectRoot);
  const files: string[] = [];

  for (const bucket of ["core", "extended"] as const) {
    const dir = join(skillsRoot, bucket);
    if (existsSync(dir)) {
      walk(dir, files);
    }
  }

  return files.sort();
}

export type ReadSkillResult = ParsedFrontmatter & {
  filePath: string;
  relativePath: string;
};

export function readSkill(filePath: string, projectRoot: string): ReadSkillResult {
  const content = readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(content, filePath);
  return {
    filePath,
    relativePath: relative(getSkillsRoot(projectRoot), filePath),
    ...parsed,
  };
}

export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export function writeJson(path: string, data: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function readPackageVersion(projectRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export type SkillIndexEntry = {
  name: string;
  path: string;
  description: string;
  triggers: string[];
  when_to_use: string;
  when_not_to_use: string;
  prerequisites: string[];
  estimated_tokens: number;
  roles_suggested: string[];
  version: string;
  tags: string[];
};

export type SkillsIndex = {
  version: string;
  built_at: string;
  builder_version: string;
  skills: SkillIndexEntry[];
};

export function loadIndex(projectRoot: string): { indexPath: string; index: SkillsIndex } {
  const indexPath = join(getSkillsRoot(projectRoot), "INDEX.json");
  if (!existsSync(indexPath)) {
    throw new Error(`Missing ${indexPath}. Run: flowctl skills build-index`);
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as SkillsIndex;
  return { indexPath, index };
}

export type SkillMetaFilters = {
  role?: string | null;
  tag?: string | null;
  trigger?: string | null;
};

export function filterSkillsByMeta(
  skills: SkillIndexEntry[],
  filters: SkillMetaFilters,
): SkillIndexEntry[] {
  let out = skills;
  const { role, tag, trigger } = filters;
  if (role) {
    out = out.filter(
      (s) =>
        !Array.isArray(s.roles_suggested) ||
        s.roles_suggested.length === 0 ||
        s.roles_suggested.includes(role),
    );
  }
  if (tag) {
    out = out.filter((s) => Array.isArray(s.tags) && s.tags.includes(tag));
  }
  if (trigger) {
    out = out.filter((s) => Array.isArray(s.triggers) && s.triggers.includes(trigger));
  }
  return out;
}

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return content;
  return content.slice(end + 5);
}

export function appendUsageLog(projectRoot: string, payload: unknown): void {
  const logPath = join(projectRoot, ".flowctl", "skill_usage.jsonl");
  ensureDir(dirname(logPath));
  appendFileSync(logPath, `${JSON.stringify(payload)}\n`, "utf8");
}

export function printIssues(issues: SkillIssue[]): void {
  for (const issue of issues) {
    const prefix = issue.severity === "error" ? "ERROR" : "WARN";
    console.error(`${prefix} ${issue.file}:${issue.line} ${issue.message}`);
    if (issue.suggestion) {
      console.error(`  suggestion: ${issue.suggestion}`);
    }
  }
}

export type ScoreSkillOptions = { role?: string };

function rolesFromSkill(skill: Record<string, unknown>): string[] {
  const hyphen = skill["roles-suggested"];
  const under = skill["roles_suggested"];
  if (Array.isArray(hyphen)) return hyphen.map((x) => String(x));
  if (Array.isArray(under)) return under.map((x) => String(x));
  return [];
}

export function scoreSkill(
  skill: Record<string, unknown>,
  queryTokens: string[],
  options: ScoreSkillOptions = {},
): number {
  let score = 0;
  const name = String(skill.name ?? "").toLowerCase();
  const desc = String(skill.description ?? "").toLowerCase();
  const triggers = Array.isArray(skill.triggers)
    ? skill.triggers.map((x) => String(x).toLowerCase())
    : [];
  const tags = Array.isArray(skill.tags) ? skill.tags.map((x) => String(x).toLowerCase()) : [];
  const roles = rolesFromSkill(skill);

  for (const token of queryTokens) {
    if (name === token) score += 10;
    else if (name.includes(token)) score += 6;
    if (triggers.includes(token)) score += 4;
    else if (triggers.some((x) => x.includes(token))) score += 2;
    if (desc.includes(token)) score += 1;
    if (tags.includes(token)) score += 1;
  }

  if (options.role && roles.includes(options.role)) {
    score += 2;
  }
  if (options.role && roles.length > 0 && !roles.includes(options.role)) {
    score -= 1;
  }

  return score;
}
