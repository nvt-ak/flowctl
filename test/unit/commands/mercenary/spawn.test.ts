import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runMercenarySpawn } from "@/commands/mercenary/spawn";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/mercenary/spawn", () => {
  it("prints success when no mercenary requests", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runMercenarySpawn(ctx);
    });

    expect(logs.join("\n")).toContain("No mercenary requests");
    log.mockRestore();
  });

  it("writes brief files and spawn board for each request", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    let briefText = "";
    await makeCtx(
      async (ctx) => {
        const reportsDir = join(ctx.paths.dispatchBase, "step-1", "reports");
        await mkdir(reportsDir, { recursive: true });
        await writeFile(
          join(reportsDir, "backend-report.md"),
          [
            "## NEEDS_SPECIALIST",
            "- type: researcher",
            '  query: "Pick OAuth library"',
            '  blocking: "Auth design"',
          ].join("\n"),
          "utf-8",
        );
        await runMercenarySpawn(ctx, { timeout: 1800 });
        const briefPath = join(
          ctx.paths.dispatchBase,
          "step-1",
          "mercenaries",
          "researcher-1-brief.md",
        );
        briefText = await readFile(briefPath, "utf-8");
      },
      { currentStep: 1 },
    );

    const out = logs.join("\n");
    expect(out).toContain("MERCENARY SPAWN BOARD");
    expect(out).toContain("@mercenary");
    expect(briefText).toContain("Pick OAuth library");
    log.mockRestore();
  });
});
