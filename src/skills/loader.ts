import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLoadArgv, parseProjectRootFlag } from "@/skills/args";
import {
  appendUsageLog,
  getProjectRoot,
  loadIndex,
  stripFrontmatter,
  type SkillIndexEntry,
} from "@/skills/utils";

export type LoadSkillResult = {
  skill: SkillIndexEntry;
  body: string;
};

export function loadSkill(projectRoot: string, name: string): LoadSkillResult {
  const { index } = loadIndex(projectRoot);
  const skill = index.skills.find((s) => s.name === name);

  if (!skill) {
    throw new Error(`Skill not found: ${name}`);
  }

  const absPath = join(projectRoot, ".cursor", "skills", skill.path);
  const raw = readFileSync(absPath, "utf8");
  const body = stripFrontmatter(raw).replace(/^\n+/, "");

  appendUsageLog(projectRoot, {
    ts: new Date().toISOString(),
    skill: skill.name,
    version: skill.version,
    role: null,
    agent: null,
    task_id: null,
    loaded: true,
    score: null,
    tokens_loaded: skill.estimated_tokens,
    outcome: "pending",
    relevance_feedback: null,
  });

  return { skill, body };
}

export function runLoadSkill(argv: string[] = process.argv.slice(2)): number {
  const { target, format } = parseLoadArgv(argv);
  if (!target) {
    console.error("Usage: flowctl skills load <name> [--format body|json]");
    return 1;
  }

  const rootOverride = parseProjectRootFlag(argv);
  const projectRoot = rootOverride
    ? getProjectRoot(["--project-root", rootOverride])
    : getProjectRoot(argv);

  let result: LoadSkillResult;
  try {
    result = loadSkill(projectRoot, target);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }

  if (format === "json") {
    console.log(JSON.stringify({ skill: result.skill, body: result.body }, null, 2));
  } else {
    process.stdout.write(result.body);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(runLoadSkill());
}
