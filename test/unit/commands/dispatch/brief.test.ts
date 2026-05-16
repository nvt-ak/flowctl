import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultState } from "@/state/default-state";
import {
  generateRoleBriefs,
  writeContextSnapshotFile,
} from "@/commands/dispatch/brief";

describe("dispatch brief generation", () => {
  it("throws when step is missing from state", async () => {
    const repo = await mkdtemp(join(tmpdir(), "flowctl-brief-miss-"));
    const state = defaultState();
    const dispatchDir = join(repo, "workflows", "dispatch", "step-9");
    await expect(
      generateRoleBriefs({
        state,
        step: "10",
        repoRoot: repo,
        dispatchDir,
        reportsDir: join(dispatchDir, "reports"),
        dispatchBase: join(repo, "workflows", "dispatch"),
        roles: ["pm"],
      }),
    ).rejects.toThrow(/missing step 10/);
  });

  it("writeContextSnapshotFile writes snapshot under dispatch dir", async () => {
    const repo = await mkdtemp(join(tmpdir(), "flowctl-brief-snap-"));
    const state = defaultState();
    state.current_step = 4;
    const dispatchDir = join(repo, "workflows", "dispatch", "step-4");
    const rel = await writeContextSnapshotFile({
      state,
      step: "4",
      repoRoot: repo,
      dispatchDir,
      reportsDir: join(dispatchDir, "reports"),
      dispatchBase: join(repo, "workflows", "dispatch"),
      roles: ["backend"],
    });
    expect(rel).toBe("workflows/dispatch/step-4/context-snapshot.md");
    const snap = await readFile(join(repo, rel), "utf-8");
    expect(snap).toContain("Context Snapshot");
  });

  it("includes GitNexus layer for code steps", async () => {
    const repo = await mkdtemp(join(tmpdir(), "flowctl-brief-code-"));
    const state = defaultState();
    state.current_step = 4;
    const dispatchDir = join(repo, "workflows", "dispatch", "step-4");
    const reportsDir = join(dispatchDir, "reports");

    await generateRoleBriefs({
      state,
      step: "4",
      repoRoot: repo,
      dispatchDir,
      reportsDir,
      dispatchBase: join(repo, "workflows", "dispatch"),
      roles: ["backend"],
    });

    const brief = await readFile(join(dispatchDir, "backend-brief.md"), "utf-8");
    expect(brief).toContain("GitNexus CLI");
  });

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
