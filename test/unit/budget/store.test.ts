import { readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initBudgetArtifacts, markRoleBudgetCompleted } from "@/budget/store";
import { pathExists } from "@/utils/fs";

async function seedBudgetState(
  stateFile: string,
  body: Record<string, unknown>,
): Promise<void> {
  await writeFile(stateFile, JSON.stringify(body, null, 2), "utf-8");
}

describe("budget/store", () => {
  it("initBudgetArtifacts creates default state and empty events when missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-store-"));
    const stateFile = join(dir, "nested", "budget.json");
    const eventsFile = join(dir, "nested", "events.jsonl");

    await initBudgetArtifacts(stateFile, eventsFile);

    expect(await pathExists(stateFile)).toBe(true);
    expect(await pathExists(eventsFile)).toBe(true);

    const state = JSON.parse(await readFile(stateFile, "utf-8")) as {
      breaker: { state: string };
      roles: Record<string, unknown>;
    };
    expect(state.breaker.state).toBe("closed");
    expect(state.roles).toEqual({});
    expect(await readFile(eventsFile, "utf-8")).toBe("");
  });

  it("initBudgetArtifacts does not overwrite existing files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-store-"));
    const stateFile = join(dir, "budget.json");
    const eventsFile = join(dir, "events.jsonl");
    await writeFile(stateFile, '{"custom":true}', "utf-8");
    await writeFile(eventsFile, "existing\n", "utf-8");

    await initBudgetArtifacts(stateFile, eventsFile);

    expect(await readFile(stateFile, "utf-8")).toBe('{"custom":true}');
    expect(await readFile(eventsFile, "utf-8")).toBe("existing\n");
  });

  it("markRoleBudgetCompleted no-ops when state file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-store-"));
    const stateFile = join(dir, "missing.json");
    const eventsFile = join(dir, "events.jsonl");

    await markRoleBudgetCompleted(stateFile, eventsFile, 1, "backend");
    expect(await pathExists(stateFile)).toBe(false);
  });

  it("markRoleBudgetCompleted no-ops when run step mismatches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-store-"));
    const stateFile = join(dir, "budget.json");
    const eventsFile = join(dir, "events.jsonl");
    await seedBudgetState(stateFile, {
      run: { step: 2 },
      roles: { backend: { status: "running" } },
    });

    await markRoleBudgetCompleted(stateFile, eventsFile, 1, "backend");

    const state = JSON.parse(await readFile(stateFile, "utf-8")) as {
      roles: Record<string, { status?: string }>;
    };
    expect(state.roles.backend?.status).toBe("running");
  });

  it("markRoleBudgetCompleted marks role done when step matches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-store-"));
    const stateFile = join(dir, "budget.json");
    const eventsFile = join(dir, "events.jsonl");
    await seedBudgetState(stateFile, {
      run: { step: 3 },
      roles: { qa: { status: "running" } },
      breaker: { state: "closed" },
    });

    await markRoleBudgetCompleted(stateFile, eventsFile, 3, "qa");

    const state = JSON.parse(await readFile(stateFile, "utf-8")) as {
      roles: Record<string, { status?: string; updated_at?: string }>;
    };
    expect(state.roles.qa?.status).toBe("done");
    expect(state.roles.qa?.updated_at).toMatch(/Z$/);
  });

  it("markRoleBudgetCompleted closes half-open breaker for probe role", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-budget-store-"));
    const stateFile = join(dir, "budget.json");
    const eventsFile = join(dir, "events.jsonl");
    await seedBudgetState(stateFile, {
      run: { step: 1 },
      roles: { backend: { status: "running" } },
      breaker: {
        state: "half-open",
        probe_role: "backend",
        reason: "probe",
        opened_at: "2026-01-01T00:00:00Z",
      },
    });

    await markRoleBudgetCompleted(stateFile, eventsFile, 1, "backend");

    const state = JSON.parse(await readFile(stateFile, "utf-8")) as {
      breaker: { state: string; probe_role?: string };
    };
    expect(state.breaker.state).toBe("closed");
    expect(state.breaker.probe_role ?? "").toBe("");

    const events = await readFile(eventsFile, "utf-8");
    expect(events).toContain("breaker_transition");
    expect(events).toContain("half_open_probe_succeeded");
  });
});
