import { join } from "node:path";
import {
  discoverSkillFiles,
  getProjectRoot,
  getSkillsRoot,
  printIssues,
  readPackageVersion,
  readSkill,
  type SkillIssue,
  validateFrontmatter,
  writeJson,
} from "@/skills/utils";
import { parseProjectRootFlag } from "@/skills/args";

export type BuildIndexResult =
  | { ok: true; indexPath: string; skillCount: number }
  | { ok: false; issues: SkillIssue[] };

export function buildSkillsIndex(projectRoot: string): BuildIndexResult {
  const files = discoverSkillFiles(projectRoot);
  const seenNames = new Set<string>();
  const issues: SkillIssue[] = [];
  const skills: Array<{
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
  }> = [];

  for (const file of files) {
    try {
      const skill = readSkill(file, projectRoot);
      const localIssues = validateFrontmatter(skill.data, file, skill.lineMap, seenNames);
      issues.push(...localIssues);

      if (localIssues.length === 0) {
        const name = String(skill.data.name);
        seenNames.add(name);
        skills.push({
          name,
          path: skill.relativePath,
          description: String(skill.data.description),
          triggers: skill.data.triggers as string[],
          when_to_use: String(skill.data["when-to-use"]),
          when_not_to_use: String(skill.data["when-not-to-use"]),
          prerequisites: (skill.data.prerequisites as string[]) || [],
          estimated_tokens: skill.data["estimated-tokens"] as number,
          roles_suggested: (skill.data["roles-suggested"] as string[]) || [],
          version: String(skill.data.version),
          tags: (skill.data.tags as string[]) || [],
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      issues.push({
        file,
        line: 1,
        severity: "error",
        message,
        suggestion: "Fix frontmatter format: must start/end with ---.",
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));

  const index = {
    version: "1.0.0",
    built_at: new Date().toISOString(),
    builder_version: `flowctl ${readPackageVersion(projectRoot)}`,
    skills,
  };

  const indexPath = join(getSkillsRoot(projectRoot), "INDEX.json");
  writeJson(indexPath, index);
  return { ok: true, indexPath, skillCount: skills.length };
}

export function runBuildIndex(argv: string[] = process.argv.slice(2)): number {
  const rootOverride = parseProjectRootFlag(argv);
  const projectRoot = rootOverride
    ? getProjectRoot(["--project-root", rootOverride])
    : getProjectRoot(argv);

  const result = buildSkillsIndex(projectRoot);
  if (!result.ok) {
    printIssues(result.issues);
    return 1;
  }

  console.log(`INDEX built: ${result.indexPath} (${result.skillCount} skills)`);
  return 0;
}

if (import.meta.main) {
  process.exit(runBuildIndex());
}
