import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathExists } from "@/utils/fs";

const DEFAULT_STATE = `{
  "breaker": {
    "state": "closed",
    "reason": "",
    "opened_at": "",
    "last_transition_at": "",
    "cooldown_seconds": 300,
    "probe_role": ""
  },
  "run": {
    "flow_id": "",
    "run_id": "",
    "step": 0,
    "started_at": "",
    "consumed_tokens_est": 0,
    "consumed_runtime_seconds": 0,
    "consumed_cost_usd": 0.0,
    "last_updated_at": "",
    "override_used": false,
    "override_reason": "",
    "override_at": ""
  },
  "roles": {}
}
`;

export async function initBudgetArtifacts(
  stateFile: string,
  eventsFile: string,
): Promise<void> {
  await mkdir(dirname(stateFile), { recursive: true });
  await mkdir(dirname(eventsFile), { recursive: true });
  if (!(await pathExists(stateFile))) {
    await writeFile(stateFile, DEFAULT_STATE, "utf-8");
  }
  if (!(await pathExists(eventsFile))) {
    await writeFile(eventsFile, "", "utf-8");
  }
}

export async function markRoleBudgetCompleted(
  stateFile: string,
  eventsFile: string,
  step: number,
  role: string,
): Promise<void> {
  if (!(await pathExists(stateFile))) return;
  const state = JSON.parse(await readFile(stateFile, "utf-8")) as {
    run?: { step?: number };
    roles?: Record<string, { status?: string; updated_at?: string }>;
    breaker?: {
      state?: string;
      probe_role?: string;
      reason?: string;
      opened_at?: string;
      last_transition_at?: string;
    };
  };
  const run = state.run ?? {};
  if (Number(run.step ?? 0) !== step) return;

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const roles = state.roles ?? {};
  roles[role] = { ...roles[role], status: "done", updated_at: now };
  state.roles = roles;

  const breaker = state.breaker ?? {};
  if (breaker.state === "half-open" && breaker.probe_role === role) {
    breaker.state = "closed";
    breaker.reason = "";
    breaker.opened_at = "";
    breaker.probe_role = "";
    breaker.last_transition_at = now;
    state.breaker = breaker;
    const ev = {
      timestamp: now,
      type: "breaker_transition",
      to_state: "closed",
      reason: "half_open_probe_succeeded",
      step,
      role,
    };
    await writeFile(eventsFile, `${JSON.stringify(ev)}\n`, { flag: "a" });
  }

  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf-8");
}
