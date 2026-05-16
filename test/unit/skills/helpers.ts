import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const validSkillFrontmatter = `---
name: test-skill
description: Short desc for unit tests
triggers: ["bug", "error", "fail"]
when-to-use: When testing
when-not-to-use: When not testing
estimated-tokens: 100
version: 1.0.0
tags: ["quality"]
roles-suggested: ["qa"]
---
Skill body content here.
`;

export async function makeSkillsProject(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "flowctl-skills-"));
  const skillDir = join(root, ".cursor", "skills", "core", "test-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), validSkillFrontmatter, "utf8");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", version: "9.9.9" }),
    "utf8",
  );
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export async function writeSkillsIndex(
  root: string,
  skills: Array<{
    name: string;
    path: string;
    description?: string;
    triggers?: string[];
    estimated_tokens?: number;
    version?: string;
    tags?: string[];
    roles_suggested?: string[];
  }>,
): Promise<void> {
  const indexDir = join(root, ".cursor", "skills");
  await mkdir(indexDir, { recursive: true });
  const index = {
    version: "1.0.0",
    built_at: "2026-01-01T00:00:00.000Z",
    builder_version: "flowctl test",
    skills: skills.map((s) => ({
      name: s.name,
      path: s.path,
      description: s.description ?? "desc",
      triggers: s.triggers ?? ["a", "b", "c"],
      when_to_use: "use",
      when_not_to_use: "not",
      prerequisites: [],
      estimated_tokens: s.estimated_tokens ?? 100,
      roles_suggested: s.roles_suggested ?? [],
      version: s.version ?? "1.0.0",
      tags: s.tags ?? [],
    })),
  };
  await writeFile(join(indexDir, "INDEX.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
}
