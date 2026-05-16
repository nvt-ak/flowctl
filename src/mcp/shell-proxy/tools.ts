import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { z } from "zod";
import { BaselinesStore } from "@/mcp/shell-proxy/baselines";
import { createShellProxyCacheFacade } from "@/mcp/shell-proxy/cache";
import { EventsLogger } from "@/mcp/shell-proxy/events";
import { readProjectIdentity } from "@/mcp/shell-proxy/registry";
import { SessionStatsStore } from "@/mcp/shell-proxy/stats";
import { BASH_EQUIV, costUsd, estimateTokens } from "@/mcp/shell-proxy/tokens";
import { ShellProxyCache } from "@/mcp/cache";

const WfGitArgs = z.object({ commits: z.number().optional() });
const WfStepContextArgs = z.object({ step: z.number().optional() });
const WfFilesArgs = z.object({
  dir: z.string().optional(),
  pattern: z.string().optional(),
  depth: z.number().optional(),
});
const WfReadArgs = z.object({
  path: z.string().min(1, "path required"),
  max_lines: z.number().optional(),
  compress: z.boolean().optional(),
});
const WfReportsArgs = z.object({ step: z.number().optional() });
const WfSetAgentArgs = z.object({ agent_id: z.string().min(1) });
const WfInvalidateArgs = z.object({
  scope: z.enum(["all", "git", "state", "files"]).optional(),
});

export type ShellProxyContext = {
  repo: string;
  stateFile: string;
  dispatchBase: string;
  cacheFacade: ReturnType<typeof createShellProxyCacheFacade>;
  baselines: BaselinesStore;
  events: EventsLogger;
  stats: SessionStatsStore;
  sh: (cmd: string) => string;
  getConnectionAgent: () => string;
  setConnectionAgent: (id: string) => void;
};

export function createShellProxyContext(opts: {
  repo: string;
  stateFile: string;
  dispatchBase: string;
  cacheDir: string;
  eventsFile: string;
  statsFile: string;
  sh?: (cmd: string) => string;
}): ShellProxyContext {
  const cache = new ShellProxyCache(opts.cacheDir);
  const baselines = new BaselinesStore(join(opts.cacheDir, "_baselines.json"));
  const stats = new SessionStatsStore(opts.statsFile);
  const proj = readProjectIdentity(opts.stateFile, opts.repo);
  const events = new EventsLogger(opts.eventsFile, proj.id, proj.name, stats);

  let connectionAgent = "unknown";

  return {
    repo: opts.repo,
    stateFile: opts.stateFile,
    dispatchBase: opts.dispatchBase,
    cacheFacade: createShellProxyCacheFacade(cache, opts.repo),
    baselines,
    events,
    stats,
    sh:
      opts.sh ??
      ((cmd: string) => {
        try {
          return execSync(cmd, {
            cwd: opts.repo,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
          }).trim();
        } catch (e: unknown) {
          const err = e as { stdout?: Buffer | string };
          return String(err.stdout ?? "").trim();
        }
      }),
    getConnectionAgent: () => connectionAgent,
    setConnectionAgent: (id: string) => {
      connectionAgent = id;
    },
  };
}

function compressJson(obj: unknown, depth = 0): string {
  if (depth > 2) return typeof obj === "object" ? `{...}` : String(obj);
  if (Array.isArray(obj)) return `[${obj.length} items]`;
  if (typeof obj !== "object" || obj === null) return String(obj);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>).slice(0, 20)) {
    if (Array.isArray(v)) lines.push(`  ${k}: [${v.length} items]`);
    else if (typeof v === "object" && v !== null) {
      lines.push(`  ${k}: {${Object.keys(v).join(", ")}}`);
    } else lines.push(`  ${k}: ${JSON.stringify(v)}`);
  }
  return `{\n${lines.join(",\n")}\n}`;
}

export function toolWfState(ctx: ShellProxyContext): Record<string, unknown> {
  const cached = ctx.cacheFacade.cacheGet("wf_state");
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };

  if (!existsSync(ctx.stateFile)) {
    return { error: "flowctl-state.json not found", _cache: "miss" };
  }
  const d = JSON.parse(readFileSync(ctx.stateFile, "utf-8")) as {
    project_name?: string;
    overall_status?: string;
    current_step?: number;
    steps?: Record<
      string,
      {
        name?: string;
        status?: string;
        agent?: string;
        support_agents?: string[];
        started_at?: string | null;
        approval_status?: string;
        blockers?: { resolved?: boolean; description?: string }[];
        decisions?: { description?: string }[];
        deliverables?: unknown[];
      }
    >;
  };
  const step = String(d.current_step ?? 0);
  const s = (d.steps ?? {})[step] ?? {};
  const openBlockers = (s.blockers ?? []).filter((b) => !b.resolved);

  const result = {
    project: d.project_name ?? "",
    status: d.overall_status ?? "unknown",
    current_step: Number(step),
    step_name: s.name ?? "",
    step_status: s.status ?? "pending",
    agent: s.agent ?? "",
    support_agents: s.support_agents ?? [],
    started_at: s.started_at ?? null,
    approval_status: s.approval_status ?? "pending",
    open_blockers: openBlockers.length,
    blockers: openBlockers.map((b) => b.description),
    recent_decisions: (s.decisions ?? []).slice(-3).map((x) => x.description),
    deliverable_count: (s.deliverables ?? []).length,
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet("wf_state", result, "state");
  return result;
}

export function toolGitContext(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfGitArgs>,
): Record<string, unknown> {
  const commits = args.commits ?? 5;
  const key = `git_ctx_${commits}`;
  const cached = ctx.cacheFacade.cacheGet(key);
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };

  const branch = ctx.sh("git rev-parse --abbrev-ref HEAD");
  const logRaw = ctx.sh(`git log --oneline -${commits} --format="%h|%s|%cr"`);
  const statusRaw = ctx.sh("git status --short");
  const ab = ctx.sh('git rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo "0\t0"');

  const recentCommits = logRaw
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [hash, msg, when] = l.split("|");
      return { hash, msg, when };
    });
  const changed = statusRaw
    .split("\n")
    .filter(Boolean)
    .map((l) => ({ status: l.slice(0, 2).trim(), file: l.slice(3) }));
  const [ahead = "0", behind = "0"] = ab.split(/\s+/);

  const result = {
    branch,
    recent_commits: recentCommits,
    changed_files: changed.length,
    changes: changed.slice(0, 10),
    ahead: Number(ahead),
    behind: Number(behind),
    is_clean: changed.length === 0,
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet(key, result, "git");
  ctx.cacheFacade.cacheSet(
    `git_status_${commits}`,
    { changed_files: changed.length, is_clean: result.is_clean },
    "ttl",
    { ttl: 15 },
  );
  return result;
}

export function toolStepContext(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfStepContextArgs>,
): Record<string, unknown> {
  const stateData = existsSync(ctx.stateFile)
    ? (JSON.parse(readFileSync(ctx.stateFile, "utf-8")) as {
        current_step?: number;
        steps?: Record<
          string,
          {
            name?: string;
            agent?: string;
            support_agents?: string[];
            status?: string;
            skip_reason?: string;
            blockers?: { resolved?: boolean; description?: string }[];
            decisions?: { type?: string; description?: string }[];
            deliverables?: unknown[];
          }
        >;
      })
    : null;
  const currentStep = args.step ?? stateData?.current_step ?? 0;
  const key = `step_ctx_${currentStep}`;
  const cached = ctx.cacheFacade.cacheGet(key);
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };
  if (!stateData) return { error: "flowctl-state.json not found", _cache: "miss" };

  const s = (stateData.steps ?? {})[String(currentStep)] ?? {};
  const priorDecisions: { step: number; text: string | undefined }[] = [];
  for (let n = 1; n < currentStep; n++) {
    const ps = (stateData.steps ?? {})[String(n)] ?? {};
    for (const d of ps.decisions ?? []) {
      if (d.type !== "rejection") {
        priorDecisions.push({ step: n, text: d.description });
      }
    }
  }
  const allBlockers: { step: number; text: string | undefined }[] = [];
  for (const [n, ps] of Object.entries(stateData.steps ?? {})) {
    for (const b of ps.blockers ?? []) {
      if (!b.resolved) {
        allBlockers.push({ step: Number(n), text: b.description });
      }
    }
  }

  const digestPath = join(ctx.dispatchBase, `step-${currentStep}`, "context-digest.md");
  let digestSummary: string | null = null;
  if (existsSync(digestPath)) {
    const raw = readFileSync(digestPath, "utf-8").split("\n");
    digestSummary = raw
      .filter((l) => l.startsWith("- ") || l.startsWith("## ") || l.startsWith("### "))
      .slice(0, 25)
      .join("\n");
  }

  const wrDir = join(ctx.dispatchBase, `step-${currentStep}`, "war-room");
  const mercDir = join(ctx.dispatchBase, `step-${currentStep}`, "mercenaries");
  const skippedSteps = Object.entries(stateData.steps ?? {})
    .filter(([, ps]) => (ps.status ?? "") === "skipped")
    .map(([n, ps]) => ({
      step: Number(n),
      name: ps.name ?? "",
      reason: ps.skip_reason ?? "",
    }))
    .sort((a, b) => a.step - b.step);

  const result = {
    step: currentStep,
    step_name: s.name ?? "",
    agent: s.agent ?? "",
    support_agents: s.support_agents ?? [],
    status: s.status ?? "pending",
    skipped_steps: skippedSteps,
    prior_decisions: priorDecisions.slice(-10),
    open_blockers: allBlockers,
    war_room_complete:
      existsSync(join(wrDir, "pm-analysis.md")) &&
      existsSync(join(wrDir, "tech-lead-assessment.md")),
    context_digest_summary: digestSummary,
    mercenary_outputs: existsSync(mercDir)
      ? readdirSync(mercDir).filter((f) => f.endsWith("-output.md"))
      : [],
    deliverables: s.deliverables ?? [],
    wf_tools_hint: [
      "Context Snapshot in worker briefs/digests first; wf_step_context() when state is newer than the brief",
      "wf_state()          ← step/status only",
      "wf_git()            ← branch + recent commits",
    ],
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet(key, result, "state");
  return result;
}

export function toolProjectFiles(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfFilesArgs>,
): Record<string, unknown> {
  const dir = args.dir ?? ".";
  const pattern = args.pattern ?? "";
  const depth = args.depth ?? 2;
  const key = `files_${dir}_${pattern}_${depth}`;
  const cached = ctx.cacheFacade.cacheGet(key);
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };

  const absDir = resolve(ctx.repo, dir);
  const IGNORE = new Set([
    "node_modules",
    ".git",
    ".cache",
    "__pycache__",
    ".graphify",
    "dist",
    "build",
  ]);

  function scan(d: string, curDepth: number): { type: string; path: string; size?: number; ext?: string }[] {
    if (curDepth > depth) return [];
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return [];
    }
    const results: { type: string; path: string; size?: number; ext?: string }[] = [];
    for (const e of entries) {
      if (IGNORE.has(e.name)) continue;
      const rel = relative(ctx.repo, join(d, e.name));
      if (pattern && !e.name.includes(pattern) && !rel.includes(pattern)) {
        if (e.isDirectory()) results.push(...scan(join(d, e.name), curDepth + 1));
        continue;
      }
      if (e.isDirectory()) {
        results.push({ type: "dir", path: rel });
        results.push(...scan(join(d, e.name), curDepth + 1));
      } else {
        let size = 0;
        try {
          size = statSync(join(d, e.name)).size;
        } catch {
          /* ignore */
        }
        results.push({ type: "file", path: rel, size, ext: extname(e.name) });
      }
    }
    return results;
  }

  const entries = scan(absDir, 0);
  const result = {
    dir: relative(ctx.repo, absDir) || ".",
    total_files: entries.filter((e) => e.type === "file").length,
    total_dirs: entries.filter((e) => e.type === "dir").length,
    entries,
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet(key, result, "ttl", { ttl: 120 });
  return result;
}

export function toolReadFile(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfReadArgs>,
): Record<string, unknown> {
  const filePath = args.path;
  const maxLines = args.max_lines ?? 100;
  const compress = args.compress ?? true;
  const absPath = resolve(ctx.repo, filePath);
  if (!existsSync(absPath)) {
    return { error: `File not found: ${filePath}`, _cache: "miss" };
  }

  const mtime = statSync(absPath).mtimeMs;
  const key = `file_${filePath.replace(/[^a-z0-9]/gi, "_")}`;
  const cached = ctx.cacheFacade.cacheGet(key);
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };

  const raw = readFileSync(absPath, "utf-8");
  const lines = raw.split("\n");
  let content = raw;
  let compressed = false;
  if (compress) {
    if (filePath.endsWith(".json") && lines.length > 50) {
      try {
        content = compressJson(JSON.parse(raw));
        compressed = true;
      } catch {
        /* fallback */
      }
    }
    if (!compressed && lines.length > maxLines) {
      content =
        `${lines.slice(0, maxLines).join("\n")}\n... [${lines.length - maxLines} more lines truncated]`;
      compressed = true;
    }
  }

  const result = {
    path: filePath,
    lines: lines.length,
    size_bytes: statSync(absPath).size,
    compressed,
    content,
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet(key, result, "mtime", { path: filePath, mtime });
  return result;
}

export function toolEnvInfo(ctx: ShellProxyContext): Record<string, unknown> {
  const cached = ctx.cacheFacade.cacheGet("env_static");
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };
  const result = {
    node: ctx.sh("node --version"),
    npm: ctx.sh("npm --version"),
    python: ctx.sh("python3 --version"),
    git: ctx.sh("git --version"),
    os: ctx.sh("uname -s"),
    arch: ctx.sh("uname -m"),
    cwd: ctx.repo,
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet("env_static", result, "static");
  return result;
}

export function toolWfReportsStatus(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfReportsArgs>,
): Record<string, unknown> {
  const stateData = existsSync(ctx.stateFile)
    ? (JSON.parse(readFileSync(ctx.stateFile, "utf-8")) as {
        current_step?: number;
        steps?: Record<string, { agent?: string; support_agents?: string[] }>;
      })
    : null;
  const currentStep = args.step ?? stateData?.current_step ?? 0;
  const key = `reports_status_${currentStep}`;
  const cached = ctx.cacheFacade.cacheGet(key);
  if (cached) return { ...(cached as Record<string, unknown>), _cache: "hit" };

  const s = (stateData?.steps ?? {})[String(currentStep)] ?? {};
  const primary = s.agent ?? "";
  const supports = s.support_agents ?? [];
  const expected = [primary, ...supports].filter(Boolean);

  const reportsDir = join(ctx.dispatchBase, `step-${currentStep}`, "reports");
  const submitted: string[] = [];
  const needsSpecialist: string[] = [];

  if (existsSync(reportsDir)) {
    for (const f of readdirSync(reportsDir).filter((x) => x.endsWith("-report.md"))) {
      const role = f.replace("-report.md", "");
      submitted.push(role);
      const content = readFileSync(join(reportsDir, f), "utf-8");
      if (content.includes("## NEEDS_SPECIALIST")) needsSpecialist.push(role);
    }
  }

  const result = {
    step: currentStep,
    expected_roles: expected,
    submitted,
    missing: expected.filter((r) => !submitted.includes(r)),
    needs_specialist: needsSpecialist,
    all_done: expected.every((r) => submitted.includes(r)),
    _cache: "miss",
  };
  ctx.cacheFacade.cacheSet(key, result, "ttl", { ttl: 30 });
  return result;
}

export function toolSetAgent(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfSetAgentArgs>,
): Record<string, unknown> {
  ctx.setConnectionAgent(args.agent_id);
  return { agent_set: ctx.getConnectionAgent() };
}

export function toolCacheInvalidate(
  ctx: ShellProxyContext,
  args: z.infer<typeof WfInvalidateArgs>,
): Record<string, unknown> {
  const scope = args.scope ?? "all";
  const gen = ctx.cacheFacade.invalidateAll(
    scope === "files" ? "all" : (scope as "all" | "git" | "state"),
  );
  ctx.events.logEvent({ type: "invalidate", scope, agent: ctx.getConnectionAgent() });
  return { invalidated: scope, new_generations: gen };
}

export function toolCacheStats(ctx: ShellProxyContext): Record<string, unknown> {
  const stats = ctx.stats.readForCacheStats();
  const tools = (stats.tools ?? {}) as Record<
    string,
    { calls: number; hits: number; saved: number }
  >;
  const toolStats = Object.entries(tools).map(([name, t]) => ({
    name,
    calls: t.calls,
    hit_rate: t.calls ? `${Math.round((t.hits / t.calls) * 100)}%` : "0%",
    saved_tokens: t.saved,
  }));
  const consumed = Number(stats.total_consumed_tokens) || 0;
  const saved = Number(stats.total_saved_tokens) || 0;
  return {
    session_start: stats.session_start,
    total_consumed_tokens: consumed,
    total_saved_tokens: saved,
    total_cost_usd: Number((Number(stats.total_cost_usd) || 0).toFixed(4)),
    total_saved_usd: Number((Number(stats.total_saved_usd) || 0).toFixed(4)),
    bash_waste_tokens: stats.bash_waste_tokens || 0,
    efficiency_pct:
      saved + consumed > 0 ? Math.round((saved / (saved + consumed)) * 100) : 0,
    tools: toolStats,
  };
}

function withLogging(
  ctx: ShellProxyContext,
  toolName: string,
  fn: (args: unknown) => Record<string, unknown>,
): (args: unknown) => Record<string, unknown> {
  return (args: unknown) => {
    const t0 = Date.now();
    const inputStr = JSON.stringify(args ?? {});
    const inputTokens = estimateTokens(inputStr);
    const result = fn(args);
    const isHit = result?._cache === "hit";
    const outputStr = JSON.stringify(result);
    const outputTokens = estimateTokens(outputStr);
    const bashEquiv = BASH_EQUIV[toolName] ?? outputTokens * 2;
    const savedTokens = Math.max(0, bashEquiv - outputTokens);
    const savedUsd = costUsd(savedTokens, 0);
    const costUsdVal = costUsd(inputTokens, outputTokens);
    if (!isHit) {
      ctx.baselines.updateBaseline(toolName, outputTokens);
    }
    ctx.events.logEvent({
      type: "mcp",
      tool: toolName,
      agent: ctx.getConnectionAgent(),
      cache: isHit ? "hit" : "miss",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      bash_equiv: bashEquiv,
      saved_tokens: savedTokens,
      cost_usd: costUsdVal,
      saved_usd: savedUsd,
      duration_ms: Date.now() - t0,
    });
    return result;
  };
}

type ShellTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  schema: z.ZodType<unknown>;
  fn: (args: unknown) => Record<string, unknown>;
};

export function buildShellProxyTools(ctx: ShellProxyContext): ShellTool[] {
  return [
    {
      name: "wf_state",
      description:
        "Current flowctl state. Replaces cat flowctl-state.json + bash status. ~95% fewer tokens.",
      inputSchema: { type: "object", properties: {} },
      schema: z.object({}),
      fn: withLogging(ctx, "wf_state", () => toolWfState(ctx)),
    },
    {
      name: "wf_git",
      description:
        "Git snapshot (branch, commits, changes). Replaces git log/status/diff. ~92% fewer tokens.",
      inputSchema: { type: "object", properties: { commits: { type: "number" } } },
      schema: WfGitArgs,
      fn: withLogging(ctx, "wf_git", (a) => toolGitContext(ctx, a as z.infer<typeof WfGitArgs>)),
    },
    {
      name: "wf_step_context",
      description:
        "Full step context (state, decisions, blockers, digest pointers). Prefer Context Snapshot in worker briefs/digests; use this when fresher state is needed.",
      inputSchema: { type: "object", properties: { step: { type: "number" } } },
      schema: WfStepContextArgs,
      fn: withLogging(ctx, "wf_step_context", (a) =>
        toolStepContext(ctx, a as z.infer<typeof WfStepContextArgs>),
      ),
    },
    {
      name: "wf_files",
      description: "Project file listing. Replaces ls + find.",
      inputSchema: {
        type: "object",
        properties: {
          dir: { type: "string" },
          pattern: { type: "string" },
          depth: { type: "number" },
        },
      },
      schema: WfFilesArgs,
      fn: withLogging(ctx, "wf_files", (a) =>
        toolProjectFiles(ctx, a as z.infer<typeof WfFilesArgs>),
      ),
    },
    {
      name: "wf_read",
      description:
        "Read file with caching + smart compression (JSON/Markdown aware). Replaces cat.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          max_lines: { type: "number" },
          compress: { type: "boolean" },
        },
        required: ["path"],
      },
      schema: WfReadArgs,
      fn: withLogging(ctx, "wf_read", (a) => toolReadFile(ctx, a as z.infer<typeof WfReadArgs>)),
    },
    {
      name: "wf_env",
      description: "Static env info (OS, versions). Cached forever.",
      inputSchema: { type: "object", properties: {} },
      schema: z.object({}),
      fn: withLogging(ctx, "wf_env", () => toolEnvInfo(ctx)),
    },
    {
      name: "wf_reports_status",
      description:
        "Check which roles have submitted reports and if any need specialist. Replaces ls reports/ + reading files.",
      inputSchema: { type: "object", properties: { step: { type: "number" } } },
      schema: WfReportsArgs,
      fn: withLogging(ctx, "wf_reports_status", (a) =>
        toolWfReportsStatus(ctx, a as z.infer<typeof WfReportsArgs>),
      ),
    },
    {
      name: "wf_set_agent",
      description:
        "Set agent identity for this connection (for attribution tracking). Call at start of each agent session.",
      inputSchema: {
        type: "object",
        properties: { agent_id: { type: "string" } },
        required: ["agent_id"],
      },
      schema: WfSetAgentArgs,
      fn: (a) => toolSetAgent(ctx, a as z.infer<typeof WfSetAgentArgs>),
    },
    {
      name: "wf_cache_stats",
      description:
        "Token savings stats for current session — consumed, saved, cost USD, per-tool hit rates.",
      inputSchema: { type: "object", properties: {} },
      schema: z.object({}),
      fn: () => toolCacheStats(ctx),
    },
    {
      name: "wf_cache_invalidate",
      description: "Invalidate cached data. Call after modifying state.",
      inputSchema: {
        type: "object",
        properties: { scope: { type: "string", enum: ["all", "git", "state", "files"] } },
      },
      schema: WfInvalidateArgs,
      fn: (a) => toolCacheInvalidate(ctx, a as z.infer<typeof WfInvalidateArgs>),
    },
  ];
}

export function handleShellToolCall(
  _ctx: ShellProxyContext,
  tools: ShellTool[],
  name: string,
  rawArgs: unknown,
): { ok: true; result: unknown } | { ok: false; error: string } {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid arguments";
    return { ok: false, error: msg };
  }
  try {
    return { ok: true, result: tool.fn(parsed.data) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
