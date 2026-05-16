import {
  filterSkillsByMeta,
  getProjectRoot,
  loadIndex,
  type SkillIndexEntry,
  type SkillMetaFilters,
} from "@/skills/utils";
import { parseFilterFlags, parseProjectRootFlag } from "@/skills/args";

export type ListSkillsOptions = SkillMetaFilters & {
  format?: string;
};

export function listSkills(projectRoot: string, options: ListSkillsOptions = {}): SkillIndexEntry[] {
  const { index } = loadIndex(projectRoot);
  let skills = [...index.skills].sort((a, b) => a.name.localeCompare(b.name));
  skills = filterSkillsByMeta(skills, options);
  return skills;
}

export function runListSkills(argv: string[] = process.argv.slice(2)): number {
  const flags = parseFilterFlags(argv);
  const rootOverride = parseProjectRootFlag(argv);
  const projectRoot = rootOverride
    ? getProjectRoot(["--project-root", rootOverride])
    : getProjectRoot(argv);

  const skills = listSkills(projectRoot, {
    role: flags.role,
    tag: flags.tag,
    trigger: flags.trigger,
  });

  if (flags.format === "json") {
    console.log(JSON.stringify(skills, null, 2));
    return 0;
  }

  if (skills.length === 0) {
    console.log("No skills found.");
    return 0;
  }

  for (const skill of skills) {
    console.log(`${skill.name} - ${skill.description}`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(runListSkills());
}
