/**
 * Per-step token report — port of scripts/hooks/generate-token-report.py (Phase 6).
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { writeFile } from "node:fs/promises";

export type TokenReportEnv = {
  FLOWCTL_CACHE_DIR?: string;
  FLOWCTL_EVENTS_F?: string;
  FLOWCTL_STATS_F?: string;
  FLOWCTL_STATE_FILE?: string;
  WF_DISPATCH_BASE?: string;
};

export type BashWasteEvent = {
  type?: string;
  cmd?: string;
  waste_tokens?: number;
  suggestion?: string;
};

export type SessionStats = {
  tools?: Record<string, { calls?: number; hits?: number; saved?: number }>;
  total_consumed_tokens?: number;
  total_saved_tokens?: number;
  total_cost_usd?: number;
  total_saved_usd?: number;
  bash_waste_tokens?: number;
};

export function resolveReportStep(options: {
  explicitStep?: number;
  currentStep: number;
}): number {
  const { explicitStep, currentStep } = options;
  if (explicitStep !== undefined) {
    return explicitStep;
  }
  let step = currentStep;
  if (step > 1) {
    step -= 1;
  }
  return step;
}

/** Match scripts/workflow/lib/config.sh DISPATCH_BASE (per-flow vs legacy flat). */
export function resolveDispatchBaseDir(
  repoRoot: string,
  env: TokenReportEnv,
  state?: { flow_id?: string },
): string {
  const wf = env.WF_DISPATCH_BASE?.trim();
  if (wf) {
    return isAbsolute(wf) ? wf : join(repoRoot, wf);
  }
  const fid = (state?.flow_id ?? "").trim();
  if (fid.length >= 11 && fid.startsWith("wf-")) {
    const short = fid.slice(3, 11);
    return join(repoRoot, "workflows", short, "dispatch");
  }
  return join(repoRoot, "workflows", "dispatch");
}

function num(v: unknown, d = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return d;
}

export function buildTokenReportMarkdown(input: {
  step: number;
  stepName: string;
  stats: SessionStats;
  events: BashWasteEvent[];
  nowLabel?: string;
}): string {
  const { step, stepName, stats, events, nowLabel } = input;
  const tools = stats.tools ?? {};
  const consumed = num(stats.total_consumed_tokens);
  const saved = num(stats.total_saved_tokens);
  const costUsd = num(stats.total_cost_usd);
  const savedUsd = num(stats.total_saved_usd);
  const wasteTok = num(stats.bash_waste_tokens);
  const eff = consumed + saved > 0 ? (saved / (consumed + saved)) * 100 : 0;

  const bashWaste = events
    .filter((e) => e.type === "bash" && num(e.waste_tokens) > 0)
    .map((e) => ({
      cmd: String(e.cmd ?? ""),
      waste: num(e.waste_tokens),
      suggestion: String(e.suggestion ?? ""),
    }))
    .sort((a, b) => b.waste - a.waste);

  const lowHit = Object.entries(tools)
    .map(([name, t]) => {
      const calls = num(t.calls, 0);
      const hits = num(t.hits, 0);
      const rate = calls > 0 ? hits / calls : 0;
      return { name, rate, calls };
    })
    .filter((x) => x.calls >= 3 && x.rate < 0.7);

  const now =
    nowLabel ??
    new Date()
      .toISOString()
      .replace("T", " ")
      .slice(0, 16);

  const lines: string[] = [
    `# Token Report — Step ${step}: ${stepName}`,
    `Generated: ${now}`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Total consumed (est.) | ~${consumed.toLocaleString("en-US")} tokens |`,
    `| Total saved (est.)    | ~${saved.toLocaleString("en-US")} tokens |`,
    `| Efficiency            | ${eff.toFixed(0)}% |`,
    `| Cost (est.)           | $${costUsd.toFixed(4)} |`,
    `| Saved cost (est.)     | $${savedUsd.toFixed(4)} |`,
    `| Bash waste            | ~${wasteTok.toLocaleString("en-US")} tokens |`,
    "",
    "## Per-Tool Cache Performance",
    "",
    "| Tool | Calls | Hit Rate | Tokens Saved |",
    "|------|-------|----------|-------------|",
  ];

  const sortedTools = Object.entries(tools).sort((a, b) => num(b[1].saved) - num(a[1].saved));
  for (const [name, t] of sortedTools) {
    const calls = num(t.calls);
    const rate = calls > 0 ? num(t.hits) / calls : 0;
    const sv = num(t.saved);
    const flag = rate < 0.7 && calls >= 3 ? " ⚠️" : "";
    lines.push(`| \`${name}\` | ${calls} | ${(rate * 100).toFixed(0)}%${flag} | ~${sv.toLocaleString("en-US")} |`);
  }

  if (bashWaste.length > 0) {
    lines.push("", "## Top Token Waste (bash instead of MCP)", "");
    const seen = new Map<
      string,
      { cmd: string; waste: number; suggestion: string; count: number }
    >();
    for (const { cmd, waste, suggestion } of bashWaste.slice(0, 8)) {
      const key = cmd.slice(0, 40);
      const cur = seen.get(key);
      if (cur) {
        cur.count += 1;
        cur.waste += waste;
      } else {
        seen.set(key, { cmd, waste, suggestion, count: 1 });
      }
    }
    const merged = [...seen.values()].sort((a, b) => b.waste - a.waste).slice(0, 5);
    for (const v of merged) {
      const times = v.count > 1 ? ` ×${v.count}` : "";
      lines.push(`- \`${v.cmd.slice(0, 60)}\`${times} → **~${v.waste.toLocaleString("en-US")} tokens wasted**`);
      if (v.suggestion) {
        lines.push(`  → Use \`${v.suggestion}\` instead`);
      }
    }
  }

  if (lowHit.length > 0) {
    lines.push("", "## Low Cache Hit Rate (needs investigation)", "");
    for (const { name, rate, calls } of lowHit) {
      lines.push(
        `- \`${name}\`: ${(rate * 100).toFixed(0)}% hit rate over ${calls} calls — check invalidation strategy`,
      );
    }
  }

  lines.push(
    "",
    "## Recommendations",
    "",
    "- Run `wf_set_agent(agent_id)` at start of each agent session for attribution",
    "- Replace all `cat`, `git log`, `ls` with MCP tools",
    "- Check low hit rate tools — may need TTL adjustment",
  );

  return `${lines.join("\n")}\n`;
}

function resolveStateFilePath(repoRoot: string, env: TokenReportEnv): string {
  const envSf = env.FLOWCTL_STATE_FILE?.trim();
  if (envSf) {
    return isAbsolute(envSf) ? envSf : join(repoRoot, envSf);
  }
  const flowsPath = join(repoRoot, ".flowctl", "flows.json");
  if (existsSync(flowsPath)) {
    try {
      const idx = JSON.parse(readFileSync(flowsPath, "utf-8")) as {
        active_flow_id?: string;
        flows?: Record<string, { state_file?: string }>;
      };
      const active = (idx.active_flow_id ?? "").trim();
      if (active && idx.flows?.[active]) {
        const sf = (idx.flows[active].state_file ?? "").trim();
        if (sf) {
          const p = isAbsolute(sf) ? sf : join(repoRoot, sf);
          if (existsSync(p)) return p;
        }
      }
      for (const meta of Object.values(idx.flows ?? {})) {
        const sf = (meta?.state_file ?? "").trim();
        if (!sf) continue;
        const p = isAbsolute(sf) ? sf : join(repoRoot, sf);
        if (existsSync(p)) return p;
      }
    } catch {
      /* ignore */
    }
  }
  return join(repoRoot, "flowctl-state.json");
}

function loadJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function loadEvents(path: string): BashWasteEvent[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf-8").trim();
  if (!text) return [];
  const out: BashWasteEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as BashWasteEvent);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function runGenerateTokenReport(options: {
  repoRoot: string;
  env: TokenReportEnv;
  explicitStep?: number;
}): Promise<string[]> {
  const { repoRoot, env, explicitStep } = options;
  const cacheDefault = join(repoRoot, ".cache", "mcp");
  const cache = env.FLOWCTL_CACHE_DIR?.trim() || cacheDefault;
  const eventsPath = env.FLOWCTL_EVENTS_F?.trim() || join(cache, "events.jsonl");
  const statsPath = env.FLOWCTL_STATS_F?.trim() || join(cache, "session-stats.json");
  const statePath = resolveStateFilePath(repoRoot, env);

  const state = loadJsonFile<{
    current_step?: number;
    steps?: Record<string, { name?: string }>;
    flow_id?: string;
  }>(statePath, {});

  const step = resolveReportStep({
    explicitStep,
    currentStep: num(state.current_step, 0),
  });

  const stepName =
    (state.steps?.[String(step)]?.name ?? `Step ${step}`).trim() || `Step ${step}`;
  const events = loadEvents(eventsPath);
  const stats = loadJsonFile<SessionStats>(statsPath, {});

  const md = buildTokenReportMarkdown({ step, stepName, stats, events });
  const dispatchBase = resolveDispatchBaseDir(repoRoot, env, state);
  const reportPath = join(dispatchBase, `step-${step}`, "token-report.md");
  mkdirSync(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, md, "utf-8");

  let display: string;
  try {
    display = relative(repoRoot, reportPath);
  } catch {
    display = reportPath;
  }
  const outLines = [`Token report: ${display}`];

  if (existsSync(statsPath)) {
    const old = loadJsonFile<unknown>(statsPath, {});
    const archive = join(cache, `session-stats-step${step}.json`);
    await writeFile(archive, `${JSON.stringify(old, null, 2)}\n`, "utf-8");
    const fresh = {
      session_start: `${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`,
      previous_step: step,
    };
    await writeFile(statsPath, `${JSON.stringify(fresh, null, 2)}\n`, "utf-8");
  }

  return outLines;
}

export async function mainTokenReport(argv: string[]): Promise<void> {
  const args = argv.filter((a) => a !== "--");
  let step: number | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--step") {
      step = Number(args[i + 1]);
      i += 1;
    }
  }
  const repoRoot = process.cwd();
  const lines = await runGenerateTokenReport({
    repoRoot,
    env: process.env as TokenReportEnv,
    explicitStep: Number.isFinite(step) ? step : undefined,
  });
  for (const line of lines) {
    console.log(line);
  }
}

if (import.meta.main) {
  void mainTokenReport(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
