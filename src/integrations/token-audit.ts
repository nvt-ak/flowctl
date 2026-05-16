/**
 * Token audit — pure logic ported from scripts/token-audit.py (Phase 5).
 * CLI formatting lives in src/commands/audit-tokens.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OVERHEAD_TOOLS = new Set<string>([
  "wf_state",
  "wf_step_context",
  "wf_git",
  "wf_files",
  "wf_read",
  "wf_env",
  "wf_reports_status",
  "wf_cache_invalidate",
  "query_graph",
  "get_node",
  "get_neighbors",
  "get_community",
  "god_nodes",
  "graph_stats",
  "shortest_path",
  "graphify_query",
  "graphify_search",
  "graphify_get_dependencies",
  "graphify_get_clusters",
  "graphify_update_node",
  "graphify_snapshot",
  "gitnexus_query",
  "gitnexus_get_context",
  "gitnexus_detect_changes",
  "gitnexus_impact_analysis",
  "gitnexus_find_related",
  "gitnexus_get_architecture",
  "workflow_get_state",
  "workflow_add_decision",
  "workflow_add_blocker",
  "workflow_resolve_blocker",
  "workflow_request_approval",
]);

export type AuditEvent = {
  tool?: string;
  output_tokens?: number;
  saved_tokens?: number;
  cost_usd?: number;
  saved_usd?: number;
  cache?: string;
  step?: number | string | null;
  ts?: string;
  task_id?: string;
  run_id?: string;
  workflow_run_id?: string;
  flowctl_id?: string;
  correlation_id?: string;
  tier?: string;
  [key: string]: unknown;
};

export type PerToolAgg = {
  calls: number;
  tokens: number;
  saved: number;
  hits: number;
  misses: number;
  cost_usd: number;
};

export type AuditStats = {
  total_calls: number;
  total_tokens: number;
  saved_tokens: number;
  overhead_tokens: number;
  work_tokens: number;
  overhead_pct: number;
  total_cost_usd: number;
  saved_cost_usd: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
  per_tool: Record<string, PerToolAgg>;
};

export type TaskRow = {
  task: string;
  tier: string;
  total_tokens: number;
  overhead_tokens: number;
  work_tokens: number;
  calls: number;
  ratio: number | null;
};

export type GraphifyHealth = {
  status: "MISSING" | "OK" | "CORRUPT";
  nodes: number;
  relationships: number;
};

export type SessionStats = Record<string, unknown>;

export type SkillSizeRow = {
  id: string;
  compactLines: number;
  lazyLines: number;
  lazyFragments: number;
  missing: boolean;
};

function num(v: unknown, d = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return d;
}

export function analyze(events: AuditEvent[]): AuditStats {
  let totalTokens = 0;
  let savedTokens = 0;
  let totalCostUsd = 0;
  let savedCostUsd = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let overheadTokens = 0;
  let workTokens = 0;

  const perTool: Record<string, PerToolAgg> = {};

  const bumpTool = (tool: string): PerToolAgg => {
    if (!perTool[tool]) {
      perTool[tool] = { calls: 0, tokens: 0, saved: 0, hits: 0, misses: 0, cost_usd: 0 };
    }
    return perTool[tool]!;
  };

  for (const e of events) {
    const tool = (e.tool as string | undefined) ?? "unknown";
    const outT = num(e.output_tokens);
    const savT = num(e.saved_tokens);
    const cost = num(e.cost_usd);
    const savedC = num(e.saved_usd);
    const cache = (e.cache as string | undefined) ?? "miss";

    totalTokens += outT;
    savedTokens += savT;
    totalCostUsd += cost;
    savedCostUsd += savedC;

    if (cache === "hit") cacheHits += 1;
    else cacheMisses += 1;

    if (OVERHEAD_TOOLS.has(tool)) overheadTokens += outT;
    else workTokens += outT;

    const pt = bumpTool(tool);
    pt.calls += 1;
    pt.tokens += outT;
    pt.saved += savT;
    pt.cost_usd += cost;
    if (cache === "hit") pt.hits += 1;
    else pt.misses += 1;
  }

  const totalCalls = events.length;
  const hitRate = totalCalls ? (cacheHits / totalCalls) * 100 : 0;
  const overheadPct = totalTokens ? (overheadTokens / totalTokens) * 100 : 0;

  return {
    total_calls: totalCalls,
    total_tokens: totalTokens,
    saved_tokens: savedTokens,
    overhead_tokens: overheadTokens,
    work_tokens: workTokens,
    overhead_pct: overheadPct,
    total_cost_usd: totalCostUsd,
    saved_cost_usd: savedCostUsd,
    cache_hits: cacheHits,
    cache_misses: cacheMisses,
    hit_rate: hitRate,
    per_tool: perTool,
  };
}

export function inferTier(workTokens: number): string {
  if (workTokens <= 1500) return "MICRO";
  if (workTokens <= 12000) return "STANDARD";
  return "FULL";
}

export function eventTaskKey(event: AuditEvent): string {
  for (const key of [
    "task_id",
    "run_id",
    "workflow_run_id",
    "flowctl_id",
    "correlation_id",
  ] as const) {
    const value = event[key];
    if (value) return String(value);
  }
  const ts = String(event.ts ?? "");
  if (ts) {
    try {
      const parsed = new Date(ts.replace("Z", "+00:00"));
      if (!Number.isNaN(parsed.getTime())) {
        return `session-${parsed.toISOString().slice(0, 10)}`;
      }
    } catch {
      /* ignore */
    }
  }
  return "session-unknown";
}

export function analyzeByTask(events: AuditEvent[], limit?: number): TaskRow[] {
  const rows = new Map<string, TaskRow>();

  for (const event of events) {
    const key = eventTaskKey(event);
    let row = rows.get(key);
    if (!row) {
      row = {
        task: key,
        tier: "UNKNOWN",
        total_tokens: 0,
        overhead_tokens: 0,
        work_tokens: 0,
        calls: 0,
        ratio: null,
      };
      rows.set(key, row);
    }
    const tool = String(event.tool ?? "unknown");
    const outT = num(event.output_tokens);
    row.calls += 1;
    row.total_tokens += outT;
    if (OVERHEAD_TOOLS.has(tool)) row.overhead_tokens += outT;
    else row.work_tokens += outT;
    if (event.tier) row.tier = String(event.tier).toUpperCase();
  }

  const items = [...rows.values()];
  for (const item of items) {
    if (item.tier === "UNKNOWN") item.tier = inferTier(item.work_tokens);
    const work = item.work_tokens;
    const overhead = item.overhead_tokens;
    item.ratio = work > 0 ? Math.round((overhead / work) * 100) / 100 : null;
  }

  items.sort((a, b) => b.total_tokens - a.total_tokens);
  if (limit !== undefined && limit > 0) return items.slice(0, limit);
  return items;
}

export function loadEventsFromLines(
  text: string,
  opts: { days?: number; step?: number | null; now?: Date } = {},
): AuditEvent[] {
  const { days, step, now = new Date() } = opts;
  let cutoffMs: number | null = null;
  if (days !== undefined && days > 0) {
    cutoffMs = now.getTime() - days * 86400000;
  }

  const events: AuditEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let e: AuditEvent;
    try {
      e = JSON.parse(trimmed) as AuditEvent;
    } catch {
      continue;
    }
    if (cutoffMs !== null) {
      const tsStr = String(e.ts ?? "");
      if (tsStr) {
        try {
          const ts = new Date(tsStr.replace("Z", "+00:00")).getTime();
          if (!Number.isNaN(ts) && ts < cutoffMs) continue;
        } catch {
          /* keep */
        }
      }
    }
    if (step !== undefined && step !== null) {
      const st = e.step;
      if (st !== undefined && st !== null && st !== step && st !== String(step)) continue;
    }
    events.push(e);
  }
  return events;
}

export async function loadEventsFromFile(
  path: string,
  opts: { days?: number; step?: number | null; now?: Date } = {},
): Promise<AuditEvent[]> {
  try {
    const text = await readFile(path, "utf-8");
    return loadEventsFromLines(text, opts);
  } catch {
    return [];
  }
}

export async function loadSessionStats(path: string): Promise<SessionStats> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as SessionStats;
  } catch {
    return {};
  }
}

export function graphifyStatus(graphPath: string): GraphifyHealth {
  if (!existsSync(graphPath)) {
    return { status: "MISSING", nodes: 0, relationships: 0 };
  }
  try {
    const g = JSON.parse(readFileSync(graphPath, "utf-8")) as {
      nodes?: unknown;
      entities?: unknown[];
      relationships?: unknown;
      edges?: unknown[];
    };
    const nodes = g.nodes ?? g.entities ?? [];
    const rels = g.relationships ?? g.edges ?? [];
    const nodeCount = Array.isArray(nodes) ? nodes.length : typeof nodes === "object" && nodes !== null ? Object.keys(nodes as object).length : 0;
    const relCount = Array.isArray(rels) ? rels.length : 0;
    return { status: "OK", nodes: nodeCount, relationships: relCount };
  } catch {
    return { status: "CORRUPT", nodes: 0, relationships: 0 };
  }
}

/** Line count aligned with Python `splitlines()` semantics (no trailing empty line from final newline). */
function lineCount(text: string): number {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n$/, "");
  if (normalized === "") return 0;
  return normalized.split("\n").length;
}

export async function parseSkillManifestForSizes(
  projectRoot: string,
  manifestPath: string,
): Promise<SkillSizeRow[]> {
  const raw = await readFile(manifestPath, "utf-8");
  const data = JSON.parse(raw) as { skills_with_detail?: unknown[] };
  const rows = data.skills_with_detail ?? [];
  const out: SkillSizeRow[] = [];

  for (const entry of rows) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const id = String(rec.id ?? "?");
    const compactRel = rec.compact;
    const lazy = rec.lazy;
    if (typeof compactRel !== "string" || !Array.isArray(lazy)) {
      out.push({ id, compactLines: -1, lazyLines: -1, lazyFragments: 0, missing: true });
      continue;
    }
    const cp = join(projectRoot, compactRel);
    let compactLines = -1;
    if (existsSync(cp)) {
      compactLines = lineCount(readFileSync(cp, "utf-8"));
    }
    let lazyLines = 0;
    let nf = 0;
    let broken = false;
    for (const rel of lazy) {
      if (typeof rel !== "string") {
        broken = true;
        break;
      }
      const dp = join(projectRoot, rel);
      if (existsSync(dp)) {
        lazyLines += lineCount(readFileSync(dp, "utf-8"));
        nf += 1;
      } else {
        broken = true;
        break;
      }
    }
    if (broken) lazyLines = -1;
    out.push({
      id,
      compactLines,
      lazyLines,
      lazyFragments: lazyLines >= 0 ? nf : 0,
      missing: compactLines < 0 || lazyLines < 0,
    });
  }
  return out;
}

export function buildJsonPayload(
  stats: AuditStats,
  tasks: TaskRow[],
  session: SessionStats,
  graph: GraphifyHealth,
): Record<string, unknown> {
  const { per_tool: _p, ...rest } = stats;
  return {
    ...rest,
    tasks,
    session,
    graphify: graph,
  };
}
