import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runTeam } from "@/commands/team/index";
import * as collect from "@/commands/collect";
import * as dispatch from "@/commands/dispatch/index";
import * as start from "@/commands/start";
import * as budget from "@/budget/breaker";
import * as budgetStore from "@/budget/store";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/team/index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws for unknown action", async () => {
    await makeCtx(async (ctx) => {
      await expect(runTeam(ctx, "invalid")).rejects.toThrow("Unknown team action");
    });
  });

  it("start delegates with headless dispatch", async () => {
    const runStart = vi.spyOn(start, "runStart").mockResolvedValue(undefined);
    const runDispatch = vi.spyOn(dispatch, "runDispatch").mockResolvedValue(undefined);
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runTeam(ctx, "start");
    });

    expect(logs.join("\n")).toContain("[TEAM] PM step-based delegate");
    expect(runDispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headless: true }),
    );
    log.mockRestore();
    runStart.mockRestore();
    runDispatch.mockRestore();
  });

  it("sync runs collect and prints summary", async () => {
    const runCollect = vi.spyOn(collect, "runCollect").mockResolvedValue(undefined);
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runTeam(ctx, "sync");
    });

    expect(runCollect).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toContain("[TEAM] PM sync");
    log.mockRestore();
    runCollect.mockRestore();
  });

  it("status prints report and log counts", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        const reportsDir = join(ctx.paths.dispatchBase, "step-1", "reports");
        const logsDir = join(ctx.paths.dispatchBase, "step-1", "logs");
        await mkdir(reportsDir, { recursive: true });
        await mkdir(logsDir, { recursive: true });
        await writeFile(join(reportsDir, "pm-report.md"), "# r\n", "utf-8");
        await writeFile(join(logsDir, "pm.log"), "log\n", "utf-8");
        await runTeam(ctx, "status");
      },
      { currentStep: 1 },
    );

    const out = logs.join("\n");
    expect(out).toContain("[TEAM] PM status");
    expect(out).toContain("Reports: 1");
    expect(out).toContain("Logs: 1");
    log.mockRestore();
  });

  it("monitor lists role status from idempotency file", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await mkdir(dirname(ctx.paths.idempotencyFile), { recursive: true });
      await writeFile(
        ctx.paths.idempotencyFile,
        JSON.stringify({
          "step:1:role:pm:mode:headless": { status: "launched", pid: 42 },
        }),
        "utf-8",
      );
      await runTeam(ctx, "monitor", {}, { monitor: { staleSeconds: 120 } });
    });

    expect(logs.join("\n")).toContain("@pm: running");
    log.mockRestore();
  });

  it("recover rollback dry-run prints intent without removing report", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        const reportsDir = join(ctx.paths.dispatchBase, "step-1", "reports");
        const reportPath = join(reportsDir, "pm-report.md");
        await mkdir(reportsDir, { recursive: true });
        await writeFile(reportPath, "# r\n", "utf-8");
        await runTeam(ctx, "recover", {}, {
          recover: { role: "pm", mode: "rollback", dryRun: true },
        });
        const { readFile } = await import("node:fs/promises");
        expect(await readFile(reportPath, "utf-8")).toBe("# r\n");
      },
      { currentStep: 1 },
    );

    expect(logs.join("\n")).toContain("[dry-run] would rollback");
    log.mockRestore();
  });

  it("budget-reset initializes artifacts and resets breaker", async () => {
    vi.spyOn(budgetStore, "initBudgetArtifacts").mockResolvedValue(undefined);
    vi.spyOn(budget, "manualBreakerReset").mockResolvedValue("breaker reset ok");
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runTeam(ctx, "budget-reset", {}, { budgetResetReason: "test reset" });
    });

    expect(logs.join("\n")).toContain("[TEAM] PM budget reset");
    expect(logs.join("\n")).toContain("breaker reset ok");
    log.mockRestore();
  });
});
