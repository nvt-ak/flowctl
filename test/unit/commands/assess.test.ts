import { describe, expect, it, vi } from "vitest";
import { runAssess } from "@/commands/assess";
import { makeCtx } from "../../helpers/ctx";

describe("commands/assess", () => {
  it("prints workflow table with project name and current step marker", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        await runAssess(ctx);
      },
      { stateOverrides: { project_name: "Assess Demo" }, currentStep: 4 },
    );

    const out = logs.join("\n");
    expect(out).toContain("Workflow Assessment — Assess Demo");
    expect(out).toMatch(/→\s+4/);
    expect(out).toContain("Step  Status");

    log.mockRestore();
  });

  it("lists skip preset hints for hotfix and api-only", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runAssess(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("--preset hotfix");
    expect(out).toContain("skip steps 2,3,5,6");
    expect(out).toContain("--preset api-only");
    expect(out).toContain("skip steps 3,5");
    expect(out).toContain("Skip if: API-only");

    log.mockRestore();
  });
});
