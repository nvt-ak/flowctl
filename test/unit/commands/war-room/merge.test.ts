import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runWarRoomMerge } from "@/commands/war-room/merge";
import * as digest from "@/commands/war-room/digest";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/war-room/merge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when PM and TechLead outputs are missing", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await expect(runWarRoomMerge(ctx)).rejects.toThrow(/War room outputs missing/i);
    });

    expect(logs.join("\n")).toContain("No output from PM or TechLead");

    log.mockRestore();
  });

  it("generates full context digest when at least one war-room output exists", async () => {
    const generateDigest = vi
      .spyOn(digest, "generateContextDigest")
      .mockResolvedValue("workflows/dispatch/step-1/context-digest.md");

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      const wrDir = join(ctx.paths.dispatchBase, "step-1", "war-room");
      await mkdir(wrDir, { recursive: true });
      await writeFile(join(wrDir, "pm-analysis.md"), "# PM analysis\n", "utf-8");
      await runWarRoomMerge(ctx);
    });

    expect(generateDigest).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "full" }),
    );
    expect(logs.join("\n")).toContain("Context digest created");

    log.mockRestore();
  });
});
