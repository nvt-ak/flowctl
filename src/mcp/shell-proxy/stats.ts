import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { McpLogEvent } from "@/mcp/shell-proxy/events";

export type SessionStatsUpdater = {
  updateSessionStats(event: McpLogEvent): void;
};

export class SessionStatsStore implements SessionStatsUpdater {
  constructor(private readonly statsFile: string) {}

  ensureCacheDir(): void {
    mkdirSync(dirname(this.statsFile), { recursive: true });
  }

  private readRaw(): Record<string, unknown> {
    if (!existsSync(this.statsFile)) return {};
    try {
      return JSON.parse(readFileSync(this.statsFile, "utf-8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private write(stats: Record<string, unknown>): void {
    this.ensureCacheDir();
    writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
  }

  initSessionStats(): void {
    let stats = this.readRaw();
    stats.current_session = {
      session_start: new Date().toISOString(),
      consumed: 0,
      saved: 0,
    };
    if (!stats.all_time && stats.total_consumed_tokens !== undefined) {
      stats.all_time = {
        total_consumed_tokens: stats.total_consumed_tokens || 0,
        total_saved_tokens: stats.total_saved_tokens || 0,
        total_cost_usd: stats.total_cost_usd || 0,
        total_saved_usd: stats.total_saved_usd || 0,
        bash_waste_tokens: stats.bash_waste_tokens || 0,
        tools: stats.tools || {},
      };
      delete stats.total_consumed_tokens;
      delete stats.total_saved_tokens;
      delete stats.total_cost_usd;
      delete stats.total_saved_usd;
      delete stats.bash_waste_tokens;
      delete stats.session_start;
      delete stats.last_event;
      delete stats.tools;
    }
    stats.all_time = stats.all_time ?? {};
    stats.daily = stats.daily ?? {};
    this.write(stats);
  }

  updateSessionStats(event: McpLogEvent): void {
    const stats = this.readRaw();
    const today = new Date().toISOString().slice(0, 10);

    const at = (stats.all_time ?? {}) as Record<string, unknown>;
    at.total_consumed_tokens =
      (Number(at.total_consumed_tokens) || 0) + (event.output_tokens || 0);
    at.total_saved_tokens = (Number(at.total_saved_tokens) || 0) + (event.saved_tokens || 0);
    at.total_cost_usd = (Number(at.total_cost_usd) || 0) + (event.cost_usd || 0);
    at.total_saved_usd = (Number(at.total_saved_usd) || 0) + (event.saved_usd || 0);
    at.bash_waste_tokens = (Number(at.bash_waste_tokens) || 0) + (event.waste_tokens || 0);

    if (event.type === "mcp" && event.tool) {
      const tools = (at.tools ?? {}) as Record<
        string,
        { calls: number; hits: number; misses: number; saved: number }
      >;
      const ts = tools[event.tool] ?? { calls: 0, hits: 0, misses: 0, saved: 0 };
      ts.calls++;
      ts.saved += event.saved_tokens || 0;
      if (event.cache === "hit") ts.hits++;
      else ts.misses++;
      tools[event.tool] = ts;
      at.tools = tools;
    }
    stats.all_time = at;

    const daily = (stats.daily ?? {}) as Record<
      string,
      { consumed: number; saved: number; cost_usd: number }
    >;
    const day = daily[today] ?? { consumed: 0, saved: 0, cost_usd: 0 };
    day.consumed += event.output_tokens || 0;
    day.saved += event.saved_tokens || 0;
    day.cost_usd += event.cost_usd || 0;
    daily[today] = day;

    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    for (const d of Object.keys(daily)) {
      if (d < cutoffDate) delete daily[d];
    }
    stats.daily = daily;

    const cs = (stats.current_session ?? {}) as Record<string, unknown>;
    if (!cs.session_start) {
      cs.session_start = new Date().toISOString();
      cs.consumed = 0;
      cs.saved = 0;
    }
    cs.last_event = new Date().toISOString();
    cs.consumed = (Number(cs.consumed) || 0) + (event.output_tokens || 0);
    cs.saved = (Number(cs.saved) || 0) + (event.saved_tokens || 0);
    stats.current_session = cs;

    this.write(stats);
  }

  readForCacheStats(): Record<string, unknown> {
    return this.readRaw();
  }
}
