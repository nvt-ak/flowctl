import { afterEach, describe, expect, it, vi } from "vitest";
import { runSearchSkills, searchSkills } from "@/skills/search";
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

  it("filters out zero-score matches when query is non-empty", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      { name: "deployment", path: "core/deployment/SKILL.md", description: "Ship releases" },
    ]);

    const ranked = searchSkills(root, { query: "zzznomatch", limit: 5 });
    expect(ranked).toHaveLength(0);
  });

  it("runSearchSkills prints no-results message", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [{ name: "a", path: "core/a/SKILL.md" }]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runSearchSkills(["--project-root", root, "zzznomatch"]);
    log.mockRestore();

    expect(code).toBe(0);
    expect(messages).toContain("No matching skills found.");
  });

  it("runSearchSkills prints ranked rows with score", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [
      {
        name: "code-review",
        path: "core/code-review/SKILL.md",
        description: "Review pull requests",
        triggers: ["review", "pull-request", "quality"],
      },
    ]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runSearchSkills(["--project-root", root, "review"]);
    log.mockRestore();

    expect(code).toBe(0);
    expect(messages.some((m) => m.includes("score="))).toBe(true);
  });

  it("runSearchSkills prints json when --format json", async () => {
    const { root, cleanup } = await makeSkillsProject();
    cleanups.push(cleanup);
    await writeSkillsIndex(root, [{ name: "a", path: "core/a/SKILL.md" }]);

    const messages: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    });
    const code = runSearchSkills(["--project-root", root, "--format", "json", "a"]);
    log.mockRestore();

    expect(code).toBe(0);
    const payload = JSON.parse(messages[0]!) as Array<{ name: string; score: number }>;
    expect(payload[0]?.name).toBe("a");
    expect(typeof payload[0]?.score).toBe("number");
  });
});
