import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runDecision } from "@/commands/decision";
import { FlowctlStateSchema } from "@/state/schema";
import { makeCtx } from "../../helpers/ctx";

describe("commands/decision", () => {
  it("appends decision to current step and logs confirmation", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      const desc = "Adopt PostgreSQL for persistence";
      await runDecision(ctx, desc);

      const raw = await readFile(ctx.stateFile!, "utf-8");
      const state = FlowctlStateSchema.parse(JSON.parse(raw));
      const decisions = state.steps["1"]?.decisions ?? [];
      expect(decisions.length).toBeGreaterThan(0);
      const last = decisions[decisions.length - 1];
      expect(last).toMatchObject({
        description: desc,
        type: "decision",
      });
      expect(logs.join("\n")).toMatch(/Decision recorded/);
    });

    log.mockRestore();
  });

  it("rejects empty description", async () => {
    await makeCtx(async (ctx) => {
      await expect(runDecision(ctx, "   ")).rejects.toThrow(/required/i);
    });
  });
});
