import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lintSkills } from "@/skills/lint";
import { makeSkillsProject } from "./helpers";

describe("skills/lint", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((fn) => fn()));
    cleanups.length = 0;
  });

  it("returns ok for valid skill files", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);

    const result = lintSkills(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fileCount).toBe(1);
  });

  it("returns issues for broken frontmatter", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, ".cursor", "skills", "core", "broken"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "skills", "core", "broken", "SKILL.md"),
      "not yaml\n",
      "utf8",
    );

    const result = lintSkills(root);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
