import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkWasteful,
  dispatchLogBashEventJson,
  estimateTokens,
  handleCursorBeforeShell,
  type LogBashPaths,
} from "@/hooks/log-bash-event";

describe("hooks/log-bash-event", () => {
  it("estimateTokens uses json-heavy heuristic", () => {
    expect(estimateTokens('{"a":1}')).toBeGreaterThan(0);
    expect(estimateTokens("")).toBe(0);
  });

  it.each([
    ["git log --oneline -5", "wf_git()", 110],
    ["git status", "wf_git()", 110],
    ["git diff HEAD~1", "wf_git()", 110],
    ["git branch -a", "wf_git()", 110],
    ["cat flowctl-state.json", "wf_state()", 95],
    ["cat package.json", "wf_read(path)", 400],
    ["ls -la src", "wf_files()", 90],
    ["find . -name '*.ts'", "wf_files()", 90],
    ["wc -l README.md", "wf_read(path)", 400],
    ["python3 -c 'import json; print(open(\"flowctl-state.json\").read())'", "wf_state()", 95],
    ["bash scripts/flowctl.sh status", "wf_state()", 95],
  ] as const)("checkWasteful maps %j to %s", (command, suggestion, mcpAltTokens) => {
    const result = checkWasteful(command);
    expect(result.suggestion).toBe(suggestion);
    expect(result.mcpAltTokens).toBe(mcpAltTokens);
  });

  it("checkWasteful returns null for benign commands", () => {
    expect(checkWasteful("npm test")).toEqual({ suggestion: null, mcpAltTokens: 0 });
  });

  it("estimateTokens uses vietnamese-heavy heuristic", () => {
    const viet = "Đây là văn bản tiếng Việt dài hơn để kích hoạt heuristic";
    const ascii = "a".repeat(viet.length);
    expect(estimateTokens(viet)).toBeGreaterThan(estimateTokens(ascii));
  });

  it("handleCursorBeforeShell logs and returns continue JSON with agentMessage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "log-bash-"));
    const paths: LogBashPaths = {
      eventsFile: join(dir, "events.jsonl"),
      statsFile: join(dir, "session-stats.json"),
      stateFile: null,
      projectRoot: dir,
    };
    const out = handleCursorBeforeShell(
      { hook_event_name: "beforeShellExecution", command: "git status" },
      paths,
    );
    const parsed = JSON.parse(out) as { continue: boolean; agentMessage?: string };
    expect(parsed.continue).toBe(true);
    expect(parsed.agentMessage).toMatch(/wf_git\(\)/);

    const events = await readFile(paths.eventsFile, "utf-8");
    expect(events).toContain('"source":"cursor"');
    expect(events).toContain("git status");
  });

  it("dispatchLogBashEventJson routes Claude PostToolUse to stderr on waste", async () => {
    const dir = await mkdtemp(join(tmpdir(), "log-bash-"));
    const paths: LogBashPaths = {
      eventsFile: join(dir, "events.jsonl"),
      statsFile: join(dir, "session-stats.json"),
      stateFile: null,
      projectRoot: dir,
    };
    const stderr: string[] = [];
    const bigOutput = "x".repeat(2000);
    const result = dispatchLogBashEventJson(
      JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "git log --oneline" },
        tool_response: { output: bigOutput },
      }),
      paths,
      (s) => stderr.push(s),
    );
    expect(result).toBeNull();
    expect(stderr.join("")).toMatch(/TOKEN WASTE DETECTED/);
  });

  it("dispatchLogBashEventJson returns null on invalid JSON", () => {
    const paths: LogBashPaths = {
      eventsFile: "/tmp/events.jsonl",
      statsFile: "/tmp/stats.json",
      stateFile: null,
      projectRoot: "/tmp",
    };
    expect(dispatchLogBashEventJson("{bad", paths, () => {})).toBeNull();
  });
});
