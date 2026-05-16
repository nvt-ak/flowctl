import { afterEach, describe, expect, it } from "vitest";
import { searchSkills } from "@/skills/search";
import { makeSkillsProject, writeSkillsIndex } from "./helpers";

describe("skills/search", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((fn) => fn()));
    cleanups.length = 0;
  });

  it("ranks name match above description-only match", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      {
        name: "code-review",
        path: "core/code-review/SKILL.md",
        description: "Review pull requests",
        triggers: ["review", "pull-request", "quality"],
      },
      {
        name: "deployment",
        path: "core/deployment/SKILL.md",
        description: "mentions review in passing",
        triggers: ["deploy", "release", "ci"],
      },
    ]);

    const ranked = searchSkills(root, { query: "review", limit: 5 });
    expect(ranked[0]?.name).toBe("code-review");
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });

  it("returns all skills when query is empty", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "a", path: "core/a/SKILL.md" },
      { name: "b", path: "core/b/SKILL.md" },
    ]);

    const ranked = searchSkills(root, { query: "", limit: 10 });
    expect(ranked).toHaveLength(2);
    expect(ranked.every((s) => s.score === 0)).toBe(true);
  });
});
