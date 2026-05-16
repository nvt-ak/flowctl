import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  GITIGNORE_ENTRIES,
  GRAPHIFY_IGNORE_TEMPLATE,
  appendGitignoreEntries,
  ensureGraphifyIgnore,
  parseSetupMode,
  runSetup,
  updateGitignore,
  type SetupDeps,
} from "@/commands/init/setup";

describe("init/setup parseSetupMode", () => {
  it("defaults to all", () => {
    expect(parseSetupMode([])).toBe("all");
    expect(parseSetupMode(["all"])).toBe("all");
  });

  it("parses mcp-only, index-only, no-index", () => {
    expect(parseSetupMode(["--mcp-only"])).toBe("mcp-only");
    expect(parseSetupMode(["--index-only"])).toBe("index-only");
    expect(parseSetupMode(["--no-index"])).toBe("no-index");
  });
});

describe("init/setup gitignore helpers", () => {
  it("appendGitignoreEntries adds missing lines only", () => {
    const existing = "node_modules/\n.env\n!graphify-out/graph.json\n";
    const { text, added } = appendGitignoreEntries(existing, ["node_modules/", ".flowctl/", "new-entry/"]);
    expect(added).toEqual([".flowctl/", "new-entry/"]);
    expect(text).toContain("node_modules/");
    expect(text).toContain(".flowctl/");
    expect(text).toContain("new-entry/");
    expect(text.split("\n").filter((l) => l === "node_modules/")).toHaveLength(1);
  });

  it("appendGitignoreEntries adds graph.json negation when missing", () => {
    const { text, added } = appendGitignoreEntries("", GITIGNORE_ENTRIES);
    expect(added).toContain("!graphify-out/graph.json");
    expect(text).toContain("!graphify-out/graph.json");
  });

  it("updateGitignore creates file and appends entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-setup-gi-"));
    await updateGitignore(dir);
    const raw = await readFile(join(dir, ".gitignore"), "utf-8");
    expect(raw).toContain(".flowctl/");
    expect(raw).toContain("!graphify-out/graph.json");
    await updateGitignore(dir);
    const raw2 = await readFile(join(dir, ".gitignore"), "utf-8");
    expect(raw2.split("\n").filter((l) => l === ".flowctl/")).toHaveLength(1);
  });
});

describe("init/setup graphify ignore", () => {
  it("ensureGraphifyIgnore creates template once", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-setup-gf-"));
    const created = await ensureGraphifyIgnore(dir);
    expect(created).toBe(true);
    const raw = await readFile(join(dir, ".graphifyignore"), "utf-8");
    expect(raw).toBe(GRAPHIFY_IGNORE_TEMPLATE);
    const again = await ensureGraphifyIgnore(dir);
    expect(again).toBe(false);
  });
});

describe("init/setup runSetup modes", () => {
  async function mockDeps(overrides: Partial<SetupDeps> = {}): Promise<SetupDeps> {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-setup-run-"));
    return {
      projectRoot,
      workflowRoot: projectRoot,
      commandExists: () => true,
      run: vi.fn(async () => ({ ok: true, stdout: "", stderr: "" })),
      log: { info: vi.fn(), warn: vi.fn(), ok: vi.fn(), err: vi.fn() },
      mergeMcp: vi.fn(async () => ({ exitCode: 0, lines: ["MCP_STATUS=created"] })),
      ...overrides,
    };
  }

  it("mcp-only runs prerequisites and configure MCP", async () => {
    const deps = await mockDeps();
    const code = await runSetup({ mode: "mcp-only", deps, printSummary: false });
    expect(code).toBe(0);
    expect(deps.mergeMcp).toHaveBeenCalledOnce();
    expect(deps.run).not.toHaveBeenCalled();
  });

  it("index-only runs graphify install and index", async () => {
    const run = vi.fn(async (cmd: string, args: string[]) => {
      if (cmd === "python3" && args[0] === "-c") return { ok: true, stdout: "", stderr: "" };
      return { ok: true, stdout: "", stderr: "" };
    });
    const deps = await mockDeps({ run });
    const code = await runSetup({ mode: "index-only", deps, printSummary: false });
    expect(code).toBe(0);
    expect(run).toHaveBeenCalled();
    expect(deps.mergeMcp).not.toHaveBeenCalled();
  });

  it("all mode runs full pipeline when prerequisites pass", async () => {
    const run = vi.fn(async () => ({ ok: true, stdout: "", stderr: "" }));
    const deps = await mockDeps({ run });
    const code = await runSetup({ mode: "all", deps, printSummary: false });
    expect(code).toBe(0);
    expect(deps.mergeMcp).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalled();
  });

  it("no-index skips graphify update but still merges MCP", async () => {
    const run = vi.fn(async () => ({ ok: true, stdout: "", stderr: "" }));
    const deps = await mockDeps({ run });
    const code = await runSetup({ mode: "no-index", deps, printSummary: false });
    expect(code).toBe(0);
    const updateCalls = (run as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === "python3" && c[1]?.[1] === "graphify" && c[1]?.[2] === "update",
    );
    expect(updateCalls).toHaveLength(0);
    expect(deps.mergeMcp).toHaveBeenCalledOnce();
  });

  it("checkPrerequisites fails when python3 missing", async () => {
    const deps = await mockDeps({
      commandExists: (cmd) => cmd !== "python3",
    });
    await expect(runSetup({ mode: "mcp-only", deps, printSummary: false })).rejects.toThrow(
      /Python 3/,
    );
  });

  it("configureCursorMcp warns on invalid JSON (exit 2)", async () => {
    const deps = await mockDeps({
      mergeMcp: vi.fn(async () => ({
        exitCode: 2,
        lines: ["MCP_STATUS=invalid_json"],
      })),
    });
    const code = await runSetup({ mode: "mcp-only", deps, printSummary: false });
    expect(code).toBe(0);
    expect(deps.log?.warn).toHaveBeenCalled();
  });
});
