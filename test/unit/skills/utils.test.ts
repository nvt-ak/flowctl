import { describe, expect, it } from "vitest";
import { parseFrontmatter, scoreSkill, validateFrontmatter } from "@/skills/utils";

const minimalSkill = `---
name: code-review
description: Short desc for tests only here ok
triggers: ["bug", "error", "fail"]
when-to-use: When you need review
when-not-to-use: When trivial
estimated-tokens: 100
version: 1.0.0
---
Body
`;

describe("skills/utils", () => {
  it("parseFrontmatter extracts data and body", () => {
    const { data, body, lineMap } = parseFrontmatter(minimalSkill, "SKILL.md");
    expect(data.name).toBe("code-review");
    expect(body.trim()).toBe("Body");
    expect(lineMap.name).toBeGreaterThan(0);
  });

  it("validateFrontmatter passes for minimal valid skill", () => {
    const { data, lineMap } = parseFrontmatter(minimalSkill, "SKILL.md");
    const issues = validateFrontmatter(data, "SKILL.md", lineMap, new Set());
    expect(issues).toHaveLength(0);
  });

  it("validateFrontmatter flags duplicate names", () => {
    const { data, lineMap } = parseFrontmatter(minimalSkill, "SKILL.md");
    const seen = new Set<string>(["code-review"]);
    const issues = validateFrontmatter(data, "SKILL.md", lineMap, seen);
    expect(issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });

  it("scoreSkill ranks name match", () => {
    const skill = {
      name: "code-review",
      description: "Review code quality",
      triggers: ["bug", "error", "regression"],
    };
    expect(scoreSkill(skill, ["code-review"])).toBeGreaterThanOrEqual(10);
    expect(scoreSkill(skill, ["bug"])).toBeGreaterThanOrEqual(4);
  });
});
