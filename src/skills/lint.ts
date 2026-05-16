import {
  discoverSkillFiles,
  getProjectRoot,
  printIssues,
  readSkill,
  type SkillIssue,
  validateFrontmatter,
} from "@/skills/utils";
import { parseProjectRootFlag } from "@/skills/args";

export type LintSkillsResult =
  | { ok: true; fileCount: number }
  | { ok: false; issues: SkillIssue[] };

export function lintSkills(projectRoot: string): LintSkillsResult {
  const files = discoverSkillFiles(projectRoot);
  const seenNames = new Set<string>();
  const issues: SkillIssue[] = [];

  for (const file of files) {
    try {
      const skill = readSkill(file, projectRoot);
      const local = validateFrontmatter(skill.data, file, skill.lineMap, seenNames);
      issues.push(...local);
      if (local.length === 0 && typeof skill.data.name === "string") {
        seenNames.add(skill.data.name);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      issues.push({
        file,
        line: 1,
        severity: "error",
        message,
        suggestion: "Fix frontmatter markers and key/value syntax.",
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, fileCount: files.length };
}

export function runLintSkills(argv: string[] = process.argv.slice(2)): number {
  const rootOverride = parseProjectRootFlag(argv);
  const projectRoot = rootOverride
    ? getProjectRoot(["--project-root", rootOverride])
    : getProjectRoot(argv);

  const result = lintSkills(projectRoot);
  if (!result.ok) {
    printIssues(result.issues);
    console.error(`\nLint failed: ${result.issues.length} issue(s)`);
    return 1;
  }

  console.log(`Lint OK: ${result.fileCount} skill file(s) validated`);
  return 0;
}

if (import.meta.main) {
  process.exit(runLintSkills());
}
