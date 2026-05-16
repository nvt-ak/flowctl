import { mkdir, writeFile } from "node:fs/promises";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateContextDigest,
  invalidateWarRoomDigest,
  warRoomOutputsFresh,
} from "@/commands/war-room/digest";
import { defaultState } from "@/state/default-state";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/war-room/digest", () => {
  it("generateContextDigest simple mode writes digest without war-room sections", async () => {
    await makeCtx(async (ctx) => {
      const state = defaultState();
      state.current_step = 1;
      const rel = await generateContextDigest({
        state,
        stateFile: ctx.stateFile!,
        step: "1",
        stepName: "Requirements Analysis",
        wrDir: join(ctx.paths.dispatchBase, "step-1", "war-room"),
        repoRoot: ctx.projectRoot,
        dispatchBase: ctx.paths.dispatchBase,
        mode: "simple",
      });
      expect(rel).toBe("workflows/dispatch/step-1/context-digest.md");
      const text = await readFile(join(ctx.projectRoot, rel), "utf-8");
      expect(text).toContain("Context Snapshot");
      expect(text).toContain("Mode: simple");
      expect(text).not.toContain("PM Analysis");
    });
  });

  it("generateContextDigest full mode embeds war-room outputs", async () => {
    await makeCtx(async (ctx) => {
      const wrDir = join(ctx.paths.dispatchBase, "step-1", "war-room");
      await mkdir(wrDir, { recursive: true });
      await writeFile(join(wrDir, "pm-analysis.md"), "PM says ship it.\n", "utf-8");
      await writeFile(
        join(wrDir, "tech-lead-assessment.md"),
        "TL says add tests.\n",
        "utf-8",
      );

      const state = defaultState();
      const rel = await generateContextDigest({
        state,
        stateFile: ctx.stateFile!,
        step: "1",
        stepName: "Requirements Analysis",
        wrDir,
        repoRoot: ctx.projectRoot,
        dispatchBase: ctx.paths.dispatchBase,
        mode: "full",
      });
      const text = await readFile(join(ctx.projectRoot, rel), "utf-8");
      expect(text).toContain("PM Analysis");
      expect(text).toContain("PM says ship it");
      expect(text).toContain("TechLead Assessment");
    });
  });

  it("warRoomOutputsFresh is false when war-room outputs missing", async () => {
    await makeCtx(async (ctx) => {
      const wrDir = join(ctx.paths.dispatchBase, "step-1", "war-room");
      await mkdir(wrDir, { recursive: true });
      const fresh = await warRoomOutputsFresh(wrDir, ctx.stateFile!);
      expect(fresh).toBe(false);
    });
  });

  it("invalidateWarRoomDigest removes context-digest.md", async () => {
    await makeCtx(async (ctx) => {
      const digest = join(ctx.paths.dispatchBase, "step-1", "context-digest.md");
      await mkdir(join(ctx.paths.dispatchBase, "step-1"), { recursive: true });
      await writeFile(digest, "# old\n", "utf-8");
      await invalidateWarRoomDigest(ctx.paths.dispatchBase, "1");
      await expect(stat(digest)).rejects.toThrow();
    });
  });
});
