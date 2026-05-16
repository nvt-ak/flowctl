import { afterEach, describe, expect, it, vi } from "vitest";
import { listSkills, runListSkills } from "@/skills/list";
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

  it("runListSkills prints table rows for matching skills", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [{ name: "alpha", path: "core/a/SKILL.md", description: "Alpha skill" }]);

    expect(listSkills(root, {}).map((s) => s.name)).toEqual(["alpha"]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runListSkills(["--project-root", root]);
    log.mockRestore();

    expect(code).toBe(0);
    expect(messages).toContain("alpha - Alpha skill");
  });

  it("runListSkills prints json when --format json", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [{ name: "alpha", path: "core/a/SKILL.md" }]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runListSkills(["--project-root", root, "--format", "json"]);
    log.mockRestore();

    expect(code).toBe(0);
    const payload = JSON.parse(messages[0]!) as Array<{ name: string }>;
    expect(payload[0]?.name).toBe("alpha");
  });

  it("runListSkills prints empty message when no skills match filters", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [{ name: "a", path: "core/a/SKILL.md", tags: ["quality"] }]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runListSkills(["--project-root", root, "--tag", "missing-tag"]);
    log.mockRestore();

    expect(code).toBe(0);
    expect(messages).toContain("No skills found.");
  });
});
