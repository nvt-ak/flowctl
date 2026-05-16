import { describe, expect, it, vi } from "vitest";
import { runAssess } from "@/commands/assess";
import { runBrainstorm } from "@/commands/brainstorm";
import { runBudgetStatus } from "@/commands/budget";
import { runCollect } from "@/commands/collect";
import { runComplexity } from "@/commands/complexity";
import { runDecision } from "@/commands/decision";
import { runGateCheck } from "@/commands/gate";
import { runHistory } from "@/commands/history";
import { runHookCommand } from "@/commands/hook";
import { runMcp } from "@/commands/mcp";
import { runMonitor } from "@/commands/monitor";
import { runReleaseDashboard } from "@/commands/release-dashboard";
import { runRetro } from "@/commands/retro";
import { runSummary } from "@/commands/summary";
import { makeCtx } from "../../helpers/ctx";

describe("commands gate-runtime smoke", () => {
  it("runAssess prints step table", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runAssess(ctx);
    }, { stateOverrides: { project_name: "Gate Smoke" } });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runHistory prints approval history", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runHistory(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runDecision records a decision", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runDecision(ctx, "Use Vitest for coverage gate");
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Decision recorded"));
    log.mockRestore();
  });

  it("runDecision rejects empty description", async () => {
    await makeCtx(async (ctx) => {
      await expect(runDecision(ctx, "   ")).rejects.toThrow(/required/i);
    });
  });

  it("runGateCheck evaluates current step gate", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runGateCheck(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runSummary prints step summary", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runSummary(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runBrainstorm delegates to team when state exists", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runBrainstorm(ctx, { topic: "coverage gate" });
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runBudgetStatus prints budget info", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runBudgetStatus(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runComplexity scores dispatch risk", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runComplexity(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runCollect scans deliverables", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runCollect(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runRetro writes lessons.json for a step", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runRetro(ctx, "1");
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("RETRO"));
    log.mockRestore();
  });

  it("runReleaseDashboard prints dashboard path", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runReleaseDashboard(ctx);
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runHookCommand sets exitCode for unknown hook", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      process.exitCode = 0;
      await runHookCommand(ctx, "not-a-hook", []);
      expect(process.exitCode).toBe(1);
    });
    err.mockRestore();
    process.exitCode = 0;
  });

  it("runMcp --setup prints mcp.json snippet", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runMcp(ctx, { setup: true });
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("runMcp rejects when no exclusive flag", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runMcp(ctx, {});
    });
    expect(process.exitCode).toBe(1);
    err.mockRestore();
    process.exitCode = 0;
  });

  it("runMonitor fails when monitor-web.py is absent in temp repo", async () => {
    await makeCtx(async (ctx) => {
      await expect(runMonitor(ctx, [])).rejects.toMatchObject({ exitCode: expect.any(Number) });
    });
  });
});
