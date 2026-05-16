import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSkillsIndex, runBuildIndex } from "@/skills/build-index";
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

  it("rebuilding index is idempotent for skill count", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);

    const first = buildSkillsIndex(root);
    const second = buildSkillsIndex(root);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.skillCount).toBe(first.skillCount);
    expect(second.indexPath).toBe(first.indexPath);

    const raw = await readFile(second.indexPath, "utf8");
    const index = JSON.parse(raw) as { skills: Array<{ name: string }> };
    expect(index.skills).toHaveLength(first.skillCount);
  });

  it("runBuildIndex prints success path", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runBuildIndex(["--project-root", root]);
    log.mockRestore();

    expect(code).toBe(0);
    expect(messages.some((m) => /INDEX built/.test(m))).toBe(true);
  });

  it("runBuildIndex returns failure when validation fails", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, ".cursor", "skills", "core", "bad"), { recursive: true });
    await writeFile(join(root, ".cursor", "skills", "core", "bad", "SKILL.md"), "no frontmatter\n", "utf8");

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    const code = runBuildIndex(["--project-root", root]);

    expect(code).toBe(1);
    expect(errors.some((m) => /Missing frontmatter/.test(m))).toBe(true);
  });
});
