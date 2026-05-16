import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSkill, runLoadSkill } from "@/skills/loader";
import { makeSkillsProject, writeSkillsIndex } from "./helpers";

describe("skills/loader", () => {
  const cleanups: Array<() => Promise<void>> = [];
  let prevProjectRoot: string | undefined;

  afterEach(async () => {
    if (prevProjectRoot === undefined) {
      delete process.env.FLOWCTL_PROJECT_ROOT;
    } else {
      process.env.FLOWCTL_PROJECT_ROOT = prevProjectRoot;
    }
    await Promise.all(cleanups.map((fn) => fn()));
    cleanups.length = 0;
  });

  function withProjectRoot(root: string): void {
    prevProjectRoot = process.env.FLOWCTL_PROJECT_ROOT;
    process.env.FLOWCTL_PROJECT_ROOT = root;
  }

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

  it("runLoadSkill returns usage error when target is missing", () => {
    const errors: string[] = [];
    const err = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    const code = runLoadSkill([]);
    err.mockRestore();

    expect(code).toBe(1);
    expect(errors.some((m) => /Usage:/.test(m))).toBe(true);
  });

  it("runLoadSkill returns error when skill is not in index", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [{ name: "other", path: "core/other/SKILL.md" }]);

    const errors: string[] = [];
    const err = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    withProjectRoot(root);
    const code = runLoadSkill(["missing"]);
    err.mockRestore();

    expect(code).toBe(1);
    expect(errors.some((m) => /not found/i.test(m))).toBe(true);
  });

  it("runLoadSkill writes body to stdout by default", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "test-skill", path: "core/test-skill/SKILL.md", estimated_tokens: 10, version: "1.0.0" },
    ]);

    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    withProjectRoot(root);
    const code = runLoadSkill(["test-skill"]);
    write.mockRestore();

    expect(code).toBe(0);
    expect(chunks.join("")).toContain("Skill body content here.");
  });

  it("runLoadSkill prints json when --format json", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "test-skill", path: "core/test-skill/SKILL.md", estimated_tokens: 10, version: "1.0.0" },
    ]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    withProjectRoot(root);
    const code = runLoadSkill(["--format", "json", "test-skill"]);
    log.mockRestore();

    expect(code).toBe(0);
    const payload = JSON.parse(messages[0]!) as { skill: { name: string }; body: string };
    expect(payload.skill.name).toBe("test-skill");
    expect(payload.body).toContain("Skill body content here.");
  });
});
