import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSkill } from "@/skills/loader";
import { makeSkillsProject, writeSkillsIndex } from "./helpers";

describe("skills/loader", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((fn) => fn()));
    cleanups.length = 0;
  });

  it("loads skill body without frontmatter", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      {
        name: "test-skill",
        path: "core/test-skill/SKILL.md",
        estimated_tokens: 100,
        version: "1.0.0",
      },
    ]);

    const result = loadSkill(root, "test-skill");
    expect(result.skill.name).toBe("test-skill");
    expect(result.body).toContain("Skill body content here.");
    expect(result.body.startsWith("---")).toBe(false);
  });

  it("appends usage log entry", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      {
        name: "test-skill",
        path: "core/test-skill/SKILL.md",
        estimated_tokens: 42,
        version: "1.0.0",
      },
    ]);

    loadSkill(root, "test-skill");
    const logPath = join(root, ".flowctl", "skill_usage.jsonl");
    const line = (await readFile(logPath, "utf8")).trim().split("\n").pop()!;
    const entry = JSON.parse(line) as { skill: string; tokens_loaded: number; loaded: boolean };
    expect(entry.skill).toBe("test-skill");
    expect(entry.tokens_loaded).toBe(42);
    expect(entry.loaded).toBe(true);
  });

  it("throws when skill is missing from index", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "other", path: "core/other/SKILL.md" },
    ]);

    expect(() => loadSkill(root, "missing")).toThrow(/not found/i);
  });
});
