import { describe, expect, it, vi } from "vitest";
import { runHistory } from "@/commands/history";
import { FlowctlStateSchema } from "@/state/schema";
import { writeState } from "@/state/writer";
import { makeState } from "../../helpers/state";
import { makeCtx } from "../../helpers/ctx";

describe("commands/history", () => {
  it("prints approval history for approved steps", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      const state = makeState({
        project_name: "History Demo",
        current_step: 1,
      });
      const step1 = state.steps["1"];
      if (!step1) throw new Error("fixture: missing step 1");
      state.steps["1"] = {
        ...step1,
        status: "completed",
        approval_status: "approved",
        approved_by: "PM",
        approved_at: "2026-05-01",
      };
      await writeState(ctx.stateFile!, FlowctlStateSchema.parse(state));

      await runHistory(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("Approval History");
    expect(out).toContain("History Demo");
    expect(out).toContain("APPROVED");

    log.mockRestore();
  });
});
