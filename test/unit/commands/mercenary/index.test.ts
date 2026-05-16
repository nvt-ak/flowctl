import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMercenary } from "@/commands/mercenary";
import * as spawn from "@/commands/mercenary/spawn";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/mercenary/index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints usage for unknown subcommand", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await makeCtx(async (ctx) => {
      await runMercenary(ctx, "unknown-sub");
    });
    expect(log.mock.calls.some((c) => String(c[0]).includes("Usage"))).toBe(true);
    log.mockRestore();
  });

  it("scan lists mercenary requests from reports", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        const reportsDir = join(ctx.paths.dispatchBase, "step-1", "reports");
        await mkdir(reportsDir, { recursive: true });
        await writeFile(
          join(reportsDir, "pm-report.md"),
          [
            "## NEEDS_SPECIALIST",
            "- type: security",
            '  query: "Review auth flow"',
          ].join("\n"),
          "utf-8",
        );
        await runMercenary(ctx, "scan");
      },
      { currentStep: 1 },
    );

    const out = logs.join("\n");
    expect(out).toContain("MERCENARY REQUESTS");
    expect(out).toContain("security");
    log.mockRestore();
  });

  it("spawn delegates to runMercenarySpawn", async () => {
    const runSpawn = vi.spyOn(spawn, "runMercenarySpawn").mockResolvedValue(undefined);
    await makeCtx(async (ctx) => {
      await runMercenary(ctx, "spawn", { timeout: 99 });
    });
    expect(runSpawn).toHaveBeenCalledWith(expect.anything(), { timeout: 99 });
    runSpawn.mockRestore();
  });

  it("scan reports no requests when reports are clean", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runMercenary(ctx, "scan");
    });

    expect(logs.join("\n")).toContain("No NEEDS_SPECIALIST");
    log.mockRestore();
  });
});
