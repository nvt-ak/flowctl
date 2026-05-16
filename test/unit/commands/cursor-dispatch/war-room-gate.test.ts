import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateWarRoomGate,
  persistDispatchFlags,
  printWarRoomPause,
} from "@/commands/cursor-dispatch/war-room-gate";
import { defaultState } from "@/state/default-state";
import { readState } from "@/state/reader";
import { makeCtx } from "../../../helpers/ctx";

describe("cursor-dispatch/war-room-gate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WF_FORCE_WAR_ROOM;
    delete process.env.WF_WAR_ROOM_THRESHOLD;
  });

  it("skips War Room when score is below threshold", async () => {
    const state = defaultState();
    state.current_step = 1;
    const result = await evaluateWarRoomGate(
      state,
      "1",
      "/tmp/dispatch",
      {},
      { WF_WAR_ROOM_THRESHOLD: "4" },
    );
    expect(result).toEqual({ action: "skip", score: 2, threshold: 4 });
  });

  it("runs War Room when score meets threshold", async () => {
    const state = defaultState();
    state.current_step = 1;
    state.steps["1"]!.dispatch_risk = { high_risk: true };
    const result = await evaluateWarRoomGate(
      state,
      "1",
      "/tmp/dispatch",
      {},
      { WF_WAR_ROOM_THRESHOLD: "4" },
    );
    expect(result.action).toBe("run");
    if (result.action === "run") {
      expect(result.reason).toContain(">=");
    }
  });

  it("forces War Room when --force-war-room flag is set", async () => {
    const state = defaultState();
    const result = await evaluateWarRoomGate(state, "1", "/tmp/dispatch", {
      forceWarRoom: true,
    });
    expect(result.action).toBe("run");
    if (result.action === "run") {
      expect(result.reason).toBe("force-war-room");
    }
  });

  it("reuses existing digest when outputs exist and not forced", async () => {
    await makeCtx(async (ctx) => {
      const wrDir = join(ctx.paths.dispatchBase, "step-1", "war-room");
      await mkdir(wrDir, { recursive: true });
      await writeFile(join(wrDir, "context-digest.md"), "# digest\n", "utf-8");

      const read = await readState(ctx.stateFile!);
      expect(read.ok).toBe(true);
      if (!read.ok) return;

      const state = read.data;
      state.steps["1"]!.dispatch_risk = { high_risk: true };

      const result = await evaluateWarRoomGate(
        state,
        "1",
        ctx.paths.dispatchBase,
        {},
        { WF_WAR_ROOM_THRESHOLD: "1" },
      );
      expect(result).toEqual({ action: "reuse", score: expect.any(Number), threshold: 1 });
    });
  });

  it("persistDispatchFlags writes dispatch_risk fields", async () => {
    await makeCtx(async (ctx) => {
      await persistDispatchFlags(ctx.stateFile!, "1", {
        highRisk: true,
        impactedModules: 5,
      });
      const read = await readState(ctx.stateFile!);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.data.steps["1"]?.dispatch_risk?.high_risk).toBe(true);
      expect(read.data.steps["1"]?.dispatch_risk?.impacted_modules).toBe(5);
    });
  });

  it("printWarRoomPause logs merge instructions", () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    printWarRoomPause(5, 4);
    const out = logs.join("\n");
    expect(out).toContain("War Room");
    expect(out).toContain("flowctl cursor-dispatch --merge");
    log.mockRestore();
  });
});
