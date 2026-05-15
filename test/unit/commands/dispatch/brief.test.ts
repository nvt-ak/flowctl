import { mkdtemp } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultState } from "@/state/default-state";
import { generateRoleBriefs } from "@/commands/dispatch/brief";

describe("dispatch brief generation", () => {
  it("writes brief and context snapshot per role", async () => {
    const repo = await mkdtemp(join(tmpdir(), "flowctl-brief-"));
    const state = defaultState();
    state.current_step = 1;
    const dispatchDir = join(repo, "workflows", "dispatch", "step-1");
    const reportsDir = join(dispatchDir, "reports");

    await generateRoleBriefs({
      state,
      step: "1",
      repoRoot: repo,
      dispatchDir,
      reportsDir,
      dispatchBase: join(repo, "workflows", "dispatch"),
      roles: ["pm", "tech-lead"],
    });

    const pmBrief = await readFile(join(dispatchDir, "pm-brief.md"), "utf-8");
    expect(pmBrief).toContain("Worker Brief — @pm");
    expect(pmBrief).toContain("pm-report.md");

    const snap = await readFile(join(dispatchDir, "context-snapshot.md"), "utf-8");
    expect(snap).toContain("Context Snapshot");
  });
});
