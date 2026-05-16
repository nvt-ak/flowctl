/**
 * `flowctl audit-tokens` — TypeScript port of scripts/token-audit.py (Phase 5).
 */
import chalk from "chalk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FlowctlContext } from "@/cli/context";
import {
  analyze,
  analyzeByTask,
  buildJsonPayload,
  graphifyStatus,
  loadEventsFromFile,
  loadSessionStats,
  OVERHEAD_TOOLS,
  parseSkillManifestForSizes,
  type AuditStats,
  type GraphifyHealth,
  type SessionStats,
  type TaskRow,
} from "@/integrations/token-audit";

export type AuditTokensCliOptions = {
  days?: number;
  step?: number;
  format?: "table" | "markdown" | "json" | "legacy";
  limit?: number;
  json?: boolean;
  skillSizes?: boolean;
};

function flag(value: number, warn: number, crit: number, higherIsWorse = true): string {
  if (higherIsWorse) {
    if (value >= crit) return chalk.red("●");
    if (value >= warn) return chalk.yellow("●");
    return chalk.green("●");
  }
  if (value <= crit) return chalk.red("●");
  if (value <= warn) return chalk.yellow("●");
  return chalk.green("●");
}

function printTable(taskRows: TaskRow[]): void {
  console.log("Token Audit Report");
  console.log();
  console.log(`Tasks analyzed: ${taskRows.length}`);
  console.log("─".repeat(78));
  console.log(`${"Task".padEnd(24)} | ${"Tier".padEnd(8)} | ${"Total".padStart(8)} | ${"Overhead".padStart(8)} | ${"Work".padStart(8)} | ${"Ratio".padStart(6)}`);
  console.log("─".repeat(78));
  for (const row of taskRows) {
    const ratio = row.ratio !== null ? `${row.ratio}x` : "n/a";
    console.log(
      `${String(row.task).slice(0, 24).padEnd(24)} | ${String(row.tier).padEnd(8)} | ` +
        `${String(row.total_tokens).padStart(8)} | ${String(row.overhead_tokens).padStart(8)} | ` +
        `${String(row.work_tokens).padStart(8)} | ${ratio.padStart(6)}`,
    );
  }
}

function printMarkdown(taskRows: TaskRow[]): void {
  console.log("## Token Audit Report");
  console.log();
  console.log(`Tasks analyzed: ${taskRows.length}`);
  console.log();
  console.log("| Task | Tier | Total tokens | Overhead | Actual work | Ratio |");
  console.log("|------|------|--------------|----------|-------------|-------|");
  for (const row of taskRows) {
    const ratio = row.ratio !== null ? `${row.ratio}x` : "n/a";
    console.log(
      `| ${row.task} | ${row.tier} | ${row.total_tokens} | ${row.overhead_tokens} | ${row.work_tokens} | ${ratio} |`,
    );
  }
}

function printSummaryRecommendations(stats: AuditStats): void {
  const total = stats.total_tokens;
  const overhead = stats.overhead_tokens;
  const work = stats.work_tokens;
  const overheadPct = stats.overhead_pct;
  console.log();
  console.log("Overhead breakdown:");
  console.log(`  Context/setup tools : ${overhead} tokens`);
  console.log(`  Actual work tools   : ${work} tokens`);
  console.log(`  Overhead share      : ${overheadPct.toFixed(1)}%`);
  console.log();
  console.log("Break-even analysis:");
  console.log("  MICRO tasks: overhead > benefit if total work < ~1,500 tokens");
  console.log("  STANDARD tasks: break-even around ~4,000 work tokens");
  console.log("  FULL tasks: break-even around ~12,000 work tokens");
  if (total === 0) console.log("Recommendation: no data yet.");
  else if (overheadPct >= 60) console.log("Recommendation: reduce context/tool overhead for small tasks.");
  else console.log("Recommendation: current overhead/work split is acceptable.");
}

function printLegacyReport(
  stats: AuditStats,
  taskRows: TaskRow[],
  session: SessionStats,
  graph: GraphifyHealth,
): void {
  const total = stats.total_tokens;
  const saved = stats.saved_tokens;
  const ohead = stats.overhead_tokens;
  const work = stats.work_tokens;
  const hitR = stats.hit_rate;
  const cost = stats.total_cost_usd;
  const oheadP = stats.overhead_pct;
  const bashW = num(session.bash_waste_tokens);
  const bashC = num(session.bash_calls);

  console.log();
  console.log(chalk.bold("═══ flowctl Token Audit ═══"));
  console.log(`  Events analyzed : ${chalk.bold(String(stats.total_calls))}`);
  console.log("  Time range      : all events in events.jsonl\n");

  console.log(chalk.bold("Token Summary"));
  console.log(`  Total output tokens    : ${chalk.bold(String(total)).padStart(10)}`);
  console.log(
    `  ├─ Overhead (context)  : ${chalk.yellow(String(ohead)).padStart(10)}  ${oheadP.toFixed(1)}%  ${flag(oheadP, 40, 60)}`,
  );
  console.log(`  └─ Actual work         : ${chalk.green(String(work)).padStart(10)}  ${(100 - oheadP).toFixed(1)}%`);
  console.log(`  Saved by cache         : ${chalk.bold(String(saved)).padStart(10)}  ${saved === 0 ? "(none yet)" : ""}`);
  if (bashW > 0) {
    console.log(`  Bash waste tokens      : ${chalk.red(String(bashW)).padStart(10)}  (bash calls: ${bashC})`);
  }
  console.log();

  console.log(chalk.bold("Cache Health"));
  const hitFlag = flag(hitR, 50, 20, false);
  console.log(`  Hit rate      : ${chalk.bold(`${hitR.toFixed(1)}%`).padStart(8)}  ${hitFlag}`);
  console.log(`  Hits / Misses : ${stats.cache_hits} / ${stats.cache_misses}`);
  if (hitR === 0) {
    console.log(`  ${chalk.red("⚠ Cache chưa tiết kiệm được bất kỳ token nào.")}`);
    console.log("     Kiểm tra: MCP shell-proxy server có đang chạy không?");
    console.log("     Kiểm tra: wf_cache_invalidate có đang flush quá thường xuyên không?\n");
  } else if (hitR < 30) {
    console.log(`  ${chalk.yellow("Cache hit rate thấp — xem xét tăng TTL hoặc reduce invalidation scope.")}\n`);
  } else {
    console.log();
  }

  console.log(chalk.bold("Cost"));
  console.log(`  Total cost USD : $${cost.toFixed(4)}`);
  console.log(`  Saved USD      : $${stats.saved_cost_usd.toFixed(4)}`);
  console.log();

  console.log(chalk.bold("Graphify Health"));
  const gStatus = graph.status;
  const gNodes = graph.nodes;
  const gRels = graph.relationships;
  if (gStatus === "MISSING") {
    console.log(`  Status : ${chalk.red("MISSING")}  — graph.json không tồn tại`);
    console.log(`  ${chalk.red("⚠ Graphify chưa có graph. Mọi query_graph() đều trả về rỗng.")}`);
    console.log("     → Tất cả overhead từ Graphify là lãng phí thuần túy.");
    console.log("     → Fix: Chạy `python3 -m graphify update .` để build code graph.\n");
  } else if (gNodes < 10) {
    console.log(`  Status : ${chalk.yellow("SPARSE")}  — ${gNodes} nodes, ${gRels} relationships`);
    console.log(`  ${chalk.yellow("Graph quá thưa. Graphify queries ít có giá trị.")}\n`);
  } else {
    console.log(`  Status : ${chalk.green("OK")}  — ${gNodes} nodes, ${gRels} relationships\n`);
  }

  console.log(chalk.bold("Top Tools by Token Usage"));
  console.log(`  ${"Tool".padEnd(40)} ${"Calls".padStart(5)}  ${"Tokens".padStart(7)}  ${"Saved".padStart(6)}  ${"Hit%".padStart(5)}  Type`);
  console.log(`  ${"─".repeat(40)} ${"─".repeat(5)}  ${"─".repeat(7)}  ${"─".repeat(6)}  ${"─".repeat(5)}  ${"─".repeat(8)}`);
  const sortedTools = Object.entries(stats.per_tool).sort((a, b) => b[1].tokens - a[1].tokens);
  for (const [tool, v] of sortedTools.slice(0, 15)) {
    const totalToolCalls = v.hits + v.misses;
    const toolHitR = totalToolCalls ? (v.hits / totalToolCalls) * 100 : 0;
    const isOverhead = OVERHEAD_TOOLS.has(tool);
    const typeLabel = isOverhead ? chalk.yellow("overhead") : chalk.green("work");
    const savedDisplay = v.saved > 0 ? String(v.saved) : isOverhead ? chalk.red("0") : chalk.green("0");
    console.log(
      `  ${tool.padEnd(40)} ${String(v.calls).padStart(5)}  ${String(v.tokens).padStart(7)}  ${String(savedDisplay).padStart(6)}  ${toolHitR.toFixed(0).padStart(4)}%  ${typeLabel}`,
    );
  }
  console.log();

  console.log(chalk.bold("Break-Even Analysis (rough estimate)"));
  if (total > 0) {
    const unknownCalls = stats.per_tool.unknown?.calls ?? 0;
    const denom = Math.max(stats.total_calls - unknownCalls, 1);
    const overheadPerAgent = Math.floor(ohead / denom);
    console.log(`  Avg overhead/tool call : ~${overheadPerAgent} tokens`);
    console.log(`  Multi-agent worth it when actual work > ~${overheadPerAgent * 3} tokens per agent`);
    console.log("  → MICRO tasks (< ~1,500 tokens): 1 agent trực tiếp, không dùng overhead tools");
    console.log("  → STANDARD tasks: break-even ~4,000 tokens actual work");
    console.log("  → FULL tasks: break-even ~12,000 tokens actual work");
  }
  console.log();

  console.log(chalk.bold("Recommendations"));
  const recs: string[] = [];
  if (hitR < 20) recs.push(`${chalk.red("CRITICAL")} Cache không hoạt động — debug shell-proxy MCP server`);
  if (gNodes === 0) recs.push(`${chalk.red("CRITICAL")} Graphify trống — agents phải populate graph sau mỗi task`);
  if (oheadP > 60) recs.push(`${chalk.yellow("HIGH")} Overhead ${oheadP.toFixed(0)}% quá cao — bật lazy context loading`);
  if (bashW > 5000) recs.push(`${chalk.yellow("HIGH")} Bash waste ${bashW} tokens — dùng wf_* tools thay bash reads`);
  if (recs.length === 0) recs.push(`${chalk.green("OK")} Không có vấn đề nghiêm trọng được phát hiện`);
  for (const r of recs) console.log(`  • ${r}`);
  console.log();

  void taskRows;
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

async function printSkillSizes(projectRoot: string): Promise<void> {
  const manifestPath = join(projectRoot, ".cursor", "skills", "core", "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(chalk.yellow(`Missing manifest: ${manifestPath}`));
    process.exitCode = 1;
    return;
  }
  const rows = await parseSkillManifestForSizes(projectRoot, manifestPath);
  console.log();
  console.log(chalk.bold("═══ Core skills — compact vs lazy (lines) ═══"));
  console.log(`  Manifest : ${manifestPath}`);
  console.log();
  console.log(`  ${"id".padEnd(24)} ${"SKILL.md".padStart(10)}  ${"lazy total".padStart(12)}  ${"#frags".padStart(7)}`);
  console.log(`  ${"─".repeat(24)} ${"─".repeat(10)}  ${"─".repeat(12)}  ${"─".repeat(7)}`);
  let totalC = 0;
  let totalL = 0;
  for (const r of rows) {
    if (r.missing || r.compactLines < 0 || r.lazyLines < 0) {
      console.log(`  ${chalk.red(r.id).padEnd(24)}  (missing compact/lazy)`);
      continue;
    }
    totalC += r.compactLines;
    totalL += r.lazyLines;
    console.log(
      `  ${r.id.padEnd(24)} ${String(r.compactLines).padStart(10)}  ${String(r.lazyLines).padStart(12)}  ${String(r.lazyFragments).padStart(7)}`,
    );
  }
  console.log(`  ${"─".repeat(24)} ${"─".repeat(10)}  ${"─".repeat(12)}  ${"─".repeat(7)}`);
  console.log(`  ${"TOTAL (listed skills)".padEnd(24)} ${String(totalC).padStart(10)}  ${String(totalL).padStart(12)}`);
  console.log();
  console.log(
    chalk.cyan("Tip:") +
      " load `SKILL.md` first; open only the lazy reference file(s) listed in that hub (or manifest `lazy`).",
  );
  console.log();
}

function resolveGraphifyPath(projectRoot: string): string {
  const a = join(projectRoot, ".graphify", "graph.json");
  if (existsSync(a)) return a;
  return join(projectRoot, "graphify-out", "graph.json");
}

export async function runAuditTokens(ctx: FlowctlContext, opts: AuditTokensCliOptions): Promise<void> {
  if (opts.skillSizes === true) {
    await printSkillSizes(ctx.projectRoot);
    return;
  }

  const eventsPath = ctx.paths.eventsFile;
  if (!existsSync(eventsPath)) {
    console.warn(chalk.yellow(`events.jsonl không tồn tại: ${eventsPath}`));
    console.log("MCP shell-proxy chưa ghi events. Kiểm tra Cursor MCP (shell-proxy) đang chạy.");
    console.log(`Cache dir: ${ctx.paths.cacheDir}`);
  }

  const events = await loadEventsFromFile(eventsPath, {
    days: opts.days,
    step: opts.step !== undefined ? opts.step : undefined,
  });

  if (events.length === 0) {
    console.log(chalk.yellow(`Không có events nào trong ${eventsPath}`));
    console.log("Chạy một số flowctl commands rồi thử lại.\n");
    return;
  }

  const stats = analyze(events);
  const taskRows = analyzeByTask(events, opts.limit);
  const session = await loadSessionStats(ctx.paths.statsFile);
  const graph = graphifyStatus(resolveGraphifyPath(ctx.projectRoot));

  const outputFormat = opts.json === true ? "json" : (opts.format ?? "table");

  if (outputFormat === "json") {
    console.log(JSON.stringify(buildJsonPayload(stats, taskRows, session, graph), null, 2));
    return;
  }

  if (outputFormat === "markdown") {
    printMarkdown(taskRows);
    printSummaryRecommendations(stats);
    return;
  }

  if (outputFormat === "table") {
    printTable(taskRows);
    printSummaryRecommendations(stats);
    return;
  }

  printLegacyReport(stats, taskRows, session, graph);
}
