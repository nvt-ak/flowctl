import { describe, expect, it } from "vitest";
import {
  parseFilterFlags,
  parseLoadArgv,
  parseProjectRootFlag,
  positionalFromArgs,
} from "@/skills/args";

describe("skills/args", () => {
  it("parseFilterFlags applies defaults", () => {
    const flags = parseFilterFlags([]);
    expect(flags.role).toBeNull();
    expect(flags.tag).toBeNull();
    expect(flags.trigger).toBeNull();
    expect(flags.format).toBe("table");
    expect(flags.limit).toBe(5);
    expect(flags.consumed.size).toBe(0);
  });

  it("parseFilterFlags honors custom defaultFormat and defaultLimit", () => {
    const flags = parseFilterFlags([], { defaultFormat: "json", defaultLimit: 12 });
    expect(flags.format).toBe("json");
    expect(flags.limit).toBe(12);
  });

  it("parseFilterFlags treats lone --role as null value", () => {
    const flags = parseFilterFlags(["--role"]);
    expect(flags.role).toBeNull();
    expect(flags.consumed.has(0)).toBe(true);
  });

  it("parseFilterFlags treats lone --format as default format", () => {
    const flags = parseFilterFlags(["--format"]);
    expect(flags.format).toBe("table");
  });

  it("parseFilterFlags reads role, tag, trigger, limit, format", () => {
    const args = ["--role", "qa", "--tag", "api", "--trigger", "bug", "--limit", "3", "--format", "json"];
    const flags = parseFilterFlags(args);
    expect(flags.role).toBe("qa");
    expect(flags.tag).toBe("api");
    expect(flags.trigger).toBe("bug");
    expect(flags.limit).toBe(3);
    expect(flags.format).toBe("json");
    expect(flags.consumed.has(0)).toBe(true);
  });

  it("parseFilterFlags uses defaultLimit when limit is invalid", () => {
    const flags = parseFilterFlags(["--limit", "nope"], { defaultLimit: 7 });
    expect(flags.limit).toBe(7);
  });

  it("positionalFromArgs skips consumed indices", () => {
    const consumed = new Set([0, 1]);
    expect(positionalFromArgs(["--role", "pm", "search", "term"], consumed)).toBe("search term");
  });

  it("parseLoadArgv extracts target and format", () => {
    const { target, format } = parseLoadArgv(["--format", "frontmatter", "core/debugging"]);
    expect(format).toBe("frontmatter");
    expect(target).toBe("core/debugging");
  });

  it("parseLoadArgv defaults format to body", () => {
    expect(parseLoadArgv(["my-skill"]).format).toBe("body");
    expect(parseLoadArgv(["my-skill"]).target).toBe("my-skill");
    expect(parseLoadArgv(["my-skill"]).projectRootArgs).toEqual(["my-skill"]);
  });

  it("parseLoadArgv uses default format when --format has no value", () => {
    const { target, format } = parseLoadArgv(["--format"]);
    expect(format).toBe("body");
    expect(target).toBe("");
  });

  it("positionalFromArgs returns empty string when all args consumed", () => {
    const consumed = new Set([0, 1, 2]);
    expect(positionalFromArgs(["--role", "pm", "extra"], consumed)).toBe("");
  });

  it("parseProjectRootFlag returns path when present", () => {
    expect(parseProjectRootFlag(["--project-root", "/tmp/proj"])).toBe("/tmp/proj");
    expect(parseProjectRootFlag(["--project-root"])).toBeUndefined();
    expect(parseProjectRootFlag([])).toBeUndefined();
  });
});
