import { parseFilterFlags, parseProjectRootFlag, positionalFromArgs } from "@/skills/args";
import {
  filterSkillsByMeta,
  getProjectRoot,
  loadIndex,
  scoreSkill,
  type SkillIndexEntry,
  type SkillMetaFilters,
} from "@/skills/utils";

export type RankedSkill = SkillIndexEntry & { score: number };

export type SearchSkillsOptions = SkillMetaFilters & {
  query?: string;
  limit?: number;
  format?: string;
};

export function searchSkills(
  projectRoot: string,
  options: SearchSkillsOptions = {},
): RankedSkill[] {
  const { index } = loadIndex(projectRoot);
  const query = (options.query ?? "").trim();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const limit = options.limit ?? 5;

  let skills = filterSkillsByMeta(index.skills, options);

  return skills
    .map((s) => ({
      ...s,
      score: tokens.length === 0 ? 0 : scoreSkill(s, tokens, { role: options.role ?? undefined }),
    }))
    .filter((s) => tokens.length === 0 || s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function runSearchSkills(argv: string[] = process.argv.slice(2)): number {
  const flags = parseFilterFlags(argv);
  const rootOverride = parseProjectRootFlag(argv);
  const projectRoot = rootOverride
    ? getProjectRoot(["--project-root", rootOverride])
    : getProjectRoot(argv);

  const query = positionalFromArgs(argv, flags.consumed);
  const ranked = searchSkills(projectRoot, {
    role: flags.role,
    tag: flags.tag,
    trigger: flags.trigger,
    limit: flags.limit,
    query,
  });

  if (flags.format === "json") {
    console.log(JSON.stringify(ranked, null, 2));
    return 0;
  }

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (ranked.length === 0) {
    console.log("No matching skills found.");
    return 0;
  }

  for (const item of ranked) {
    const scorePart = tokens.length > 0 ? ` score=${item.score}` : "";
    console.log(`${item.name}${scorePart} - ${item.description}`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(runSearchSkills());
}
