import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCollect } from "@/commands/collect";
import * as reportCollect from "@/integrations/report-collect";
import * as evidence from "@/integrations/evidence";
import * as stateWriter from "@/state/writer";
import { makeCtx } from "../../helpers/ctx";

describe("commands/collect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints sample hint when no worker reports exist", async () => {
    vi.spyOn(reportCollect, "collectFromReports").mockReturnValue({
      noReports: true,
      reportCount: 0,
      newDeliverables: 0,
      newDecisions: 0,
      newBlockers: 0,
      newUnverified: 0,
      suggestedSkips: [],
    });
    const writeState = vi.spyOn(stateWriter, "writeState").mockResolvedValue(undefined);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runCollect(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("No worker reports");
    expect(out).toContain("agent-dispatch-template.md");
    expect(writeState).not.toHaveBeenCalled();

    log.mockRestore();
  });

  it("writes state and prints collect summary when reports are collected", async () => {
    vi.spyOn(reportCollect, "collectFromReports").mockReturnValue({
      noReports: false,
      reportCount: 2,
      newDeliverables: 3,
      newDecisions: 1,
      newBlockers: 0,
      newUnverified: 1,
      suggestedSkips: [{ step: 5, reason: "UI not in scope", source: "pm-report.md" }],
    });
    vi.spyOn(evidence, "captureStepEvidence").mockResolvedValue("Evidence manifest updated.");
    const writeState = vi.spyOn(stateWriter, "writeState").mockResolvedValue(undefined);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        const reportsDir = join(ctx.paths.dispatchBase, "step-1", "reports");
        await mkdir(reportsDir, { recursive: true });
        await writeFile(join(reportsDir, "pm-report.md"), "# PM report\n", "utf-8");
        await writeFile(join(reportsDir, "backend-report.md"), "# Backend\n", "utf-8");
        await runCollect(ctx);
      },
      { currentStep: 1 },
    );

    const out = logs.join("\n");
    expect(writeState).toHaveBeenCalledTimes(1);
    expect(out).toContain("Collect completed.");
    expect(out).toContain("COLLECTED reports=2");
    expect(out).toContain("UNVERIFIED DELIVERABLES: 1");
    expect(out).toContain("Evidence manifest updated.");
    expect(out).toContain("SUGGESTED_SKIP|5|UI not in scope|pm-report.md");

    log.mockRestore();
  });
});
