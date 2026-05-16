import { describe, expect, it, vi, afterEach } from "vitest";
import { runGateCheck } from "@/commands/gate";
import * as gate from "@/workflow/gate";
import { makeCtx } from "../../helpers/ctx";

describe("commands/gate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("prints PASS and does not set exitCode when gate passes", async () => {
    vi.spyOn(gate, "evaluateGate").mockResolvedValue({
      ok: true,
      detail: "deliverables verified",
    });
    const writeReport = vi
      .spyOn(gate, "writeGateReport")
      .mockResolvedValue(undefined);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      process.exitCode = 0;
      await runGateCheck(ctx);
      expect(process.exitCode).toBe(0);
    });

    expect(logs.join("\n")).toMatch(/QA Gate: PASS/);
    expect(logs.join("\n")).toContain("deliverables verified");
    expect(writeReport).toHaveBeenCalledWith(
      expect.anything(),
      1,
      "PASS",
      "deliverables verified",
      "gate-check",
    );

    log.mockRestore();
  });

  it("prints FAIL and sets exitCode when gate fails", async () => {
    vi.spyOn(gate, "evaluateGate").mockResolvedValue({
      ok: false,
      detail: "missing report",
    });
    vi.spyOn(gate, "writeGateReport").mockResolvedValue(undefined);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      process.exitCode = 0;
      await runGateCheck(ctx);
      expect(process.exitCode).toBe(1);
    });

    expect(logs.join("\n")).toMatch(/QA Gate: FAIL/);
    expect(logs.join("\n")).toContain("missing report");

    log.mockRestore();
  });
});
