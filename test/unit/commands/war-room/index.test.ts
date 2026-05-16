import { afterEach, describe, expect, it, vi } from "vitest";
import { runWarRoom } from "@/commands/war-room/index";
import * as briefs from "@/commands/war-room/briefs";
import * as digest from "@/commands/war-room/digest";
import * as scoring from "@/scoring/complexity";
import { setPath } from "@/state/writer";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/war-room/index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips War Room and generates simple digest when score is below threshold", async () => {
    vi.spyOn(scoring, "complexityScore").mockReturnValue(2);
    vi.spyOn(scoring, "warRoomThreshold").mockReturnValue(4);
    const generateDigest = vi
      .spyOn(digest, "generateContextDigest")
      .mockResolvedValue("workflows/dispatch/step-1/context-digest.md");
    const generateBriefs = vi.spyOn(briefs, "generateWarRoomBriefs").mockResolvedValue(undefined);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runWarRoom(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("War Room skipped");
    expect(generateDigest).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "simple" }),
    );
    expect(generateBriefs).not.toHaveBeenCalled();

    log.mockRestore();
  });

  it("generates War Room briefs when score meets threshold", async () => {
    vi.spyOn(scoring, "complexityScore").mockReturnValue(5);
    vi.spyOn(scoring, "warRoomThreshold").mockReturnValue(4);
    vi.spyOn(digest, "warRoomOutputsFresh").mockResolvedValue(false);
    const generateBriefs = vi.spyOn(briefs, "generateWarRoomBriefs").mockResolvedValue(undefined);
    const board = vi.spyOn(briefs, "printWarRoomSpawnBoard").mockImplementation(() => {});

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        await setPath(ctx.stateFile!, "steps.1.dispatch_risk.high_risk", true);
        await runWarRoom(ctx);
      },
      { currentStep: 1 },
    );

    const out = logs.join("\n");
    expect(out).toContain("WAR ROOM");
    expect(generateBriefs).toHaveBeenCalledTimes(1);
    expect(board).toHaveBeenCalledTimes(1);
    expect(out).toContain("flowctl war-room merge");

    log.mockRestore();
  });

  it("reuses outputs and regenerates full digest when war-room outputs are fresh", async () => {
    vi.spyOn(scoring, "complexityScore").mockReturnValue(5);
    vi.spyOn(scoring, "warRoomThreshold").mockReturnValue(4);
    vi.spyOn(digest, "warRoomOutputsFresh").mockResolvedValue(true);
    const generateDigest = vi
      .spyOn(digest, "generateContextDigest")
      .mockResolvedValue("workflows/dispatch/step-1/context-digest.md");
    const generateBriefs = vi.spyOn(briefs, "generateWarRoomBriefs").mockResolvedValue(undefined);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runWarRoom(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("Reusing PM/TechLead outputs");
    expect(generateDigest).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "full" }),
    );
    expect(generateBriefs).not.toHaveBeenCalled();

    log.mockRestore();
  });
});
