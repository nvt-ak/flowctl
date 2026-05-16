import { afterEach, describe, expect, it } from "vitest";
import { listSkills } from "@/skills/list";
import { makeSkillsProject, writeSkillsIndex } from "./helpers";

describe("skills/list", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((fn) => fn()));
    cleanups.length = 0;
  });

  it("lists skills sorted by name", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "zebra", path: "core/z/SKILL.md" },
      { name: "alpha", path: "core/a/SKILL.md" },
    ]);

    const skills = listSkills(root, {});
    expect(skills.map((s) => s.name)).toEqual(["alpha", "zebra"]);
  });

  it("filters by tag", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "a", path: "core/a/SKILL.md", tags: ["quality"] },
      { name: "b", path: "core/b/SKILL.md", tags: ["deploy"] },
    ]);

    const skills = listSkills(root, { tag: "quality" });
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("a");
  });
});
