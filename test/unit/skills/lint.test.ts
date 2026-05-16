import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lintSkills, runLintSkills } from "@/skills/lint";
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

  it("returns issues when required frontmatter fields are missing", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, ".cursor", "skills", "core", "incomplete"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "skills", "core", "incomplete", "SKILL.md"),
      `---
name: incomplete-skill
description: Only name and description present
---
Body
`,
      "utf8",
    );

    const result = lintSkills(root);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.message.includes("Missing required field"))).toBe(true);
  });

  it("runLintSkills prints ok summary on success", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runLintSkills(["--project-root", root]);
    log.mockRestore();

    expect(code).toBe(0);
    expect(messages.some((m) => /Lint OK/.test(m))).toBe(true);
  });

  it("runLintSkills returns failure when issues exist", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, ".cursor", "skills", "core", "broken"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "skills", "core", "broken", "SKILL.md"),
      "not yaml\n",
      "utf8",
    );

    const errors: string[] = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    const code = runLintSkills(["--project-root", root]);
    err.mockRestore();

    expect(code).toBe(1);
    expect(errors.some((m) => /Lint failed/.test(m))).toBe(true);
  });
});
