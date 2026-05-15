import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  evaluateBreakerCheck,
  manualBreakerReset,
  probeBreakerSuccess,
  reopenBreaker,
} from "@/budget/breaker";

async function seedBreaker(
  path: string,
  breaker: Record<string, unknown>,
): Promise<void> {
  await writeFile(path, JSON.stringify({ breaker }, null, 2), "utf-8");
}

describe("budget breaker state machine", () => {
  it("closed breaker allows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    await seedBreaker(file, { state: "closed", cooldown_seconds: 300 });
    const result = await evaluateBreakerCheck(file, "backend");
    expect(result.line).toContain("ALLOW|breaker=closed");
  });

  it("open breaker blocks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    const now = new Date().toISOString();
    await seedBreaker(file, {
      state: "open",
      opened_at: now,
      cooldown_seconds: 300,
    });
    const result = await evaluateBreakerCheck(file, "backend");
    expect(result.line).toContain("BLOCK|breaker=open");
  });

  it("open transitions to half-open after cooldown", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    const old = new Date(Date.now() - 400_000).toISOString();
    await seedBreaker(file, {
      state: "open",
      opened_at: old,
      cooldown_seconds: 300,
    });
    const result = await evaluateBreakerCheck(file, "backend");
    expect(result.line).toContain("ALLOW|breaker=half-open");
    const state = JSON.parse(await readFile(file, "utf-8")) as {
      breaker: { state: string };
    };
    expect(state.breaker.state).toBe("half-open");
  });

  it("half-open blocks non-probe roles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    await seedBreaker(file, {
      state: "half-open",
      probe_role: "backend",
      cooldown_seconds: 300,
    });
    const result = await evaluateBreakerCheck(file, "frontend");
    expect(result.line).toContain("BLOCK|breaker=half-open");
  });

  it("probe success closes breaker", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    await seedBreaker(file, {
      state: "half-open",
      probe_role: "backend",
      cooldown_seconds: 300,
    });
    const line = await probeBreakerSuccess(file, "backend");
    expect(line).toContain("BREAKER_CLOSED");
    const state = JSON.parse(await readFile(file, "utf-8")) as {
      breaker: { state: string; probe_role?: string };
    };
    expect(state.breaker.state).toBe("closed");
    expect(state.breaker.probe_role ?? "").toBe("");
  });

  it("manual reset closes breaker", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    await seedBreaker(file, {
      state: "open",
      opened_at: new Date().toISOString(),
      cooldown_seconds: 600,
    });
    const line = await manualBreakerReset(file, "manual reset");
    expect(line).toContain("BUDGET_RESET");
    const state = JSON.parse(await readFile(file, "utf-8")) as {
      breaker: { state: string; cooldown_seconds: number };
    };
    expect(state.breaker.state).toBe("closed");
    expect(state.breaker.cooldown_seconds).toBe(300);
  });

  it("reopen from half-open increases cooldown (L-04)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    await seedBreaker(file, {
      state: "half-open",
      probe_role: "backend",
      cooldown_seconds: 300,
    });
    await reopenBreaker(file);
    const state = JSON.parse(await readFile(file, "utf-8")) as {
      breaker: { cooldown_seconds: number };
    };
    expect(state.breaker.cooldown_seconds).toBe(450);
  });

  it("reopen cooldown capped at 1800", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-"));
    const file = join(dir, "budget.json");
    await seedBreaker(file, {
      state: "half-open",
      cooldown_seconds: 1500,
    });
    await reopenBreaker(file);
    const state = JSON.parse(await readFile(file, "utf-8")) as {
      breaker: { cooldown_seconds: number };
    };
    expect(state.breaker.cooldown_seconds).toBe(1800);
  });
});
