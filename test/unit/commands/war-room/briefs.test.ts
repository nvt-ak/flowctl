import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateWarRoomBriefs,
  printWarRoomSpawnBoard,
} from "@/commands/war-room/briefs";
import * as contextSnapshot from "@/integrations/context-snapshot";
import { defaultState } from "@/state/default-state";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/war-room/briefs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes PM and TechLead brief files with context snapshot reference", async () => {
    vi.spyOn(contextSnapshot, "buildContextSnapshot").mockResolvedValue(
      "# Context Snapshot\nFRESH\n",
    );

    await makeCtx(async (ctx) => {
      const state = defaultState();
      state.current_step = 1;
      const wrDir = join(ctx.paths.dispatchBase, "step-1", "war-room");
      await generateWarRoomBriefs({
        state,
        step: "1",
        stepName: "Requirements",
        wrDir,
        repoRoot: ctx.projectRoot,
        dispatchBase: ctx.paths.dispatchBase,
        retroDir: ctx.paths.retroDir,
      });

      const pmBrief = await readFile(join(wrDir, "pm-analysis-brief.md"), "utf-8");
      const tlBrief = await readFile(
        join(wrDir, "tech-lead-assessment-brief.md"),
        "utf-8",
      );
      expect(pmBrief).toContain("War Room Brief — @pm");
      expect(pmBrief).toContain("pm-analysis.md");
      expect(pmBrief).toContain("Context Snapshot");
      expect(tlBrief).toContain("War Room Brief — @tech-lead");
      expect(tlBrief).toContain("tech-lead-assessment.md");
    });
  });

  it("printWarRoomSpawnBoard lists spawn tabs for PM and TechLead", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      const wrDir = join(ctx.paths.dispatchBase, "step-1", "war-room");
      printWarRoomSpawnBoard(wrDir, ctx.projectRoot);
    });

    const out = logs.join("\n");
    expect(out).toContain("WAR ROOM SPAWN BOARD");
    expect(out).toContain("pm-analysis-brief.md");
    expect(out).toContain("tech-lead-assessment-brief.md");

    log.mockRestore();
  });
});
