import { describe, expect, it, vi } from "vitest";
import { runSummary } from "@/commands/summary";
import { makeCtx } from "../../helpers/ctx";

describe("commands/summary", () => {
  it("prints formatted step summary for current step", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        await runSummary(ctx);
      },
      { stateOverrides: { project_name: "Summary Project" }, currentStep: 1 },
    );

    const out = logs.join("\n");
    expect(out).toContain("Step 1 Summary");
    expect(out).toContain("━━");

    log.mockRestore();
  });
});
