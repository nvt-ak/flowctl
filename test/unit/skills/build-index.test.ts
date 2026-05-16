import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSkillsIndex } from "@/skills/build-index";
import { makeSkillsProject } from "./helpers";

describe("skills/build-index", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.map((fn) => fn()));
    cleanups.length = 0;
  });

  it("writes INDEX.json for valid skills", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);

    const result = buildSkillsIndex(root);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.skillCount).toBe(1);
    const raw = await readFile(result.indexPath, "utf8");
    const index = JSON.parse(raw) as { skills: Array<{ name: string }> };
    expect(index.skills[0]?.name).toBe("test-skill");
  });

  it("fails closed when frontmatter is invalid", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    const badPath = join(root, ".cursor", "skills", "core", "bad", "SKILL.md");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, ".cursor", "skills", "core", "bad"), { recursive: true });
    await writeFile(badPath, "no frontmatter\n", "utf8");

    const result = buildSkillsIndex(root);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
