import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runReleaseDashboard } from "@/commands/release-dashboard";
import { makeCtx } from "../../helpers/ctx";

describe("commands/release-dashboard", () => {
  it("prints dashboard markdown and writes step file by default", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runReleaseDashboard(ctx, { step: 1 });
      const outFile = join(ctx.paths.releaseDashboardDir, "step-1.md");
      const written = await readFile(outFile, "utf-8");
      expect(written).toContain("# Release Dashboard");
    });

    const body = logs.find((l) => l.includes("# Release Dashboard"));
    expect(body).toBeDefined();
    expect(logs.some((l) => l.includes("Saved:"))).toBe(true);

    log.mockRestore();
  });

  it("skips file write when noWrite is true", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runReleaseDashboard(ctx, { step: 1, noWrite: true });
      expect(logs.some((l) => l.includes("Saved:"))).toBe(false);
    });

    log.mockRestore();
  });

  it("rejects invalid step numbers", async () => {
    await makeCtx(async (ctx) => {
      await expect(runReleaseDashboard(ctx, { step: 0 })).rejects.toThrow(
        /Invalid step/i,
      );
    });
  });
});
