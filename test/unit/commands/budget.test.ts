import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runBudgetStatus } from "@/commands/budget";
import { makeCtx } from "../../helpers/ctx";

describe("commands/budget", () => {
  it("prints budget status after initializing artifacts", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runBudgetStatus(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("Budget status");
    expect(out).toContain("Breaker:");
    expect(out).toContain("Check:");

    log.mockRestore();
  });

  it("reads breaker state from budget file when present", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runBudgetStatus(ctx);
      const raw = await readFile(ctx.paths.budgetStateFile, "utf-8");
      const parsed = JSON.parse(raw) as { breaker?: { state?: string } };
      parsed.breaker = { ...parsed.breaker, state: "open", cooldown_seconds: 120 };
      const { writeFile } = await import("node:fs/promises");
      await writeFile(ctx.paths.budgetStateFile, JSON.stringify(parsed), "utf-8");
      logs.length = 0;
      await runBudgetStatus(ctx);
    });

    expect(logs.join("\n")).toContain("Breaker: open");
    expect(logs.join("\n")).toContain("Cooldown: 120s");

    log.mockRestore();
  });
});
