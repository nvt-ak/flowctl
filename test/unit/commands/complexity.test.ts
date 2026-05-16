import { afterEach, describe, expect, it, vi } from "vitest";
import { runComplexity } from "@/commands/complexity";
import * as scoring from "@/scoring/complexity";
import { setPath } from "@/state/writer";
import { makeCtx } from "../../helpers/ctx";

describe("commands/complexity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WF_WAR_ROOM_THRESHOLD;
  });

  it("prints MICRO tier verdict for score 1", async () => {
    vi.spyOn(scoring, "complexityScore").mockReturnValue(1);
    vi.spyOn(scoring, "complexityTier").mockReturnValue("MICRO");
    vi.spyOn(scoring, "warRoomThreshold").mockReturnValue(4);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runComplexity(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("Complexity Score — Step 1");
    expect(out).toContain("MICRO");
    expect(out).toContain("1 agent, light ceremony");

    log.mockRestore();
  });

  it("prints FULL tier verdict when score is high", async () => {
    vi.spyOn(scoring, "complexityScore").mockReturnValue(5);
    vi.spyOn(scoring, "complexityTier").mockReturnValue("FULL");
    vi.spyOn(scoring, "warRoomThreshold").mockReturnValue(4);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runComplexity(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("FULL");
    expect(out).toContain("War Room (PM + TechLead)");

    log.mockRestore();
  });

  it("uses state war_room_threshold when set", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        await setPath(ctx.stateFile!, "settings.war_room_threshold", 3);
        await runComplexity(ctx);
      },
      { currentStep: 2 },
    );

    expect(logs.join("\n")).toContain("War Room threshold: 3");

    log.mockRestore();
  });
});
