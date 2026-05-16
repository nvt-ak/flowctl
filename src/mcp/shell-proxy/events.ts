import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SessionStatsUpdater } from "./stats";

export type McpLogEvent = {
  type: string;
  tool?: string;
  agent?: string;
  cache?: string;
  input_tokens?: number;
  output_tokens?: number;
  bash_equiv?: number;
  saved_tokens?: number;
  cost_usd?: number;
  saved_usd?: number;
  duration_ms?: number;
  scope?: string;
  waste_tokens?: number;
  project_id?: string;
  project_name?: string;
  ts?: string;
};

export class EventsLogger {
  constructor(
    private readonly eventsFile: string,
    private readonly projectId: string,
    private readonly projectName: string,
    private readonly statsUpdater: SessionStatsUpdater,
  ) {}

  ensureCacheDir(): void {
    mkdirSync(dirname(this.eventsFile), { recursive: true });
  }

  logEvent(event: McpLogEvent): void {
    this.ensureCacheDir();
    try {
      const content = existsSync(this.eventsFile) ? readFileSync(this.eventsFile, "utf-8") : "";
      const lines = content.split("\n").filter(Boolean);
      if (lines.length > 1000) {
        writeFileSync(this.eventsFile, `${lines.slice(-800).join("\n")}\n`);
      }
    } catch {
      /* ignore rotation errors */
    }
    const row = {
      ...event,
      project_id: this.projectId,
      project_name: this.projectName,
      ts: new Date().toISOString(),
    };
    appendFileSync(this.eventsFile, `${JSON.stringify(row)}\n`);
    this.statsUpdater.updateSessionStats(event);
  }
}
