import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { printSpawnBoard } from "@/commands/cursor-dispatch/board";
import { defaultState } from "@/state/default-state";

describe("cursor-dispatch/board", () => {
  it("prints spawn board and writes spawn-board.txt", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-board-"));
    try {
      const state = defaultState();
      state.current_step = 1;
      const dispatchDir = join(projectRoot, "workflows", "dispatch", "step-1");
      await mkdir(dispatchDir, { recursive: true });
      await writeFile(join(dispatchDir, "context-digest.md"), "# digest\n", "utf-8");

      const logs: string[] = [];
      const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
        logs.push(String(msg));
      });

      await printSpawnBoard({
        state,
        step: "1",
        stepName: "Requirements Analysis",
        projectRoot,
        dispatchDir,
        stateFile: join(projectRoot, ".flowctl/flows/t1/state.json"),
      });

      const out = logs.join("\n");
      expect(out).toContain("CURSOR SPAWN BOARD");
      expect(out).toContain("Spawn @pm");
      expect(out).toContain("Context digest");
      expect(out).toContain("flowctl collect");

      const boardTxt = await readFile(join(dispatchDir, "spawn-board.txt"), "utf-8");
      expect(boardTxt).toContain("CURSOR SPAWN BOARD");
      expect(boardTxt).toContain("pm, tech-lead");

      log.mockRestore();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("prints multi-flow hint when state file is under .flowctl/flows/", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-board-"));
    try {
      const state = defaultState();
      const dispatchDir = join(projectRoot, "workflows", "dispatch", "step-1");
      await mkdir(dispatchDir, { recursive: true });
      const stateFile = join(projectRoot, ".flowctl/flows/t1/state.json");

      const logs: string[] = [];
      const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
        logs.push(String(msg));
      });

      await printSpawnBoard({
        state,
        step: "1",
        stepName: "Requirements Analysis",
        projectRoot,
        dispatchDir,
        stateFile,
      });

      expect(logs.join("\n")).toContain("FLOWCTL_STATE_FILE");
      log.mockRestore();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
