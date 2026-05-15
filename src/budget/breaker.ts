import { readFile, writeFile } from "node:fs/promises";
import { pathExists } from "@/utils/fs";

export type BudgetStateFile = {
  breaker?: {
    state?: string;
    opened_at?: string;
    cooldown_seconds?: number;
    probe_role?: string;
    reason?: string;
    last_transition_at?: string;
  };
  run?: Record<string, unknown>;
};

function parseIso(s: string): Date | null {
  if (!s) return null;
  try {
    return new Date(s.replace("Z", "+00:00"));
  } catch {
    return null;
  }
}

function utcNowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function loadState(file: string): Promise<BudgetStateFile> {
  if (!(await pathExists(file))) return {};
  return JSON.parse(await readFile(file, "utf-8")) as BudgetStateFile;
}

async function saveState(file: string, state: BudgetStateFile): Promise<void> {
  await writeFile(file, JSON.stringify(state, null, 2), "utf-8");
}

/** Port of budget.sh breaker check (TC-07 parity). */
export async function evaluateBreakerCheck(
  stateFile: string,
  role: string,
  now: Date = new Date(),
): Promise<{ line: string }> {
  const state = await loadState(stateFile);
  const breaker = state.breaker ?? {};
  const cooldownSeconds = Number(breaker.cooldown_seconds ?? 300);
  let bstate = breaker.state ?? "closed";

  if (bstate === "open") {
    const openedAt = parseIso(breaker.opened_at ?? "");
    if (
      openedAt &&
      (now.getTime() - openedAt.getTime()) / 1000 >= cooldownSeconds
    ) {
      breaker.state = "half-open";
      bstate = "half-open";
      state.breaker = breaker;
      await saveState(stateFile, state);
    }
  }

  if (bstate === "open") {
    return { line: "BLOCK|breaker=open" };
  }
  if (bstate === "half-open") {
    const probeRole = (breaker.probe_role ?? "").trim();
    if (probeRole && probeRole !== role) {
      return { line: `BLOCK|breaker=half-open probe_role=${probeRole}` };
    }
    if (!probeRole) {
      breaker.probe_role = role;
      state.breaker = breaker;
      await saveState(stateFile, state);
    }
    return { line: `ALLOW|breaker=half-open probe_role=${role}` };
  }
  return { line: "ALLOW|breaker=closed" };
}

export async function probeBreakerSuccess(
  stateFile: string,
  _role: string,
): Promise<string> {
  const state = await loadState(stateFile);
  const breaker = state.breaker ?? {};
  breaker.state = "closed";
  breaker.probe_role = "";
  breaker.opened_at = "";
  state.breaker = breaker;
  await saveState(stateFile, state);
  return "BREAKER_CLOSED|probe_success";
}

export async function manualBreakerReset(
  stateFile: string,
  reason: string,
): Promise<string> {
  if (!(await pathExists(stateFile))) {
    return "BUDGET_RESET|state_missing";
  }
  const state = await loadState(stateFile);
  const breaker = state.breaker ?? {};
  breaker.state = "closed";
  breaker.reason = reason;
  breaker.opened_at = "";
  breaker.probe_role = "";
  breaker.last_transition_at = utcNowIso();
  breaker.cooldown_seconds = 300;
  state.breaker = breaker;
  await saveState(stateFile, state);
  return "BUDGET_RESET|breaker=closed";
}

export async function reopenBreaker(stateFile: string): Promise<string> {
  const state = await loadState(stateFile);
  const breaker = state.breaker ?? {};
  const baseCooldown = 300;
  const prev = Number(breaker.cooldown_seconds ?? baseCooldown);
  const wasHalfOpen = breaker.state === "half-open";
  const newCooldown = wasHalfOpen
    ? Math.min(Math.floor(prev * 1.5), 1800)
    : baseCooldown;
  breaker.state = "open";
  breaker.opened_at = utcNowIso();
  breaker.cooldown_seconds = newCooldown;
  breaker.probe_role = "";
  state.breaker = breaker;
  await saveState(stateFile, state);
  return `BREAKER_OPEN|cooldown=${newCooldown}`;
}
