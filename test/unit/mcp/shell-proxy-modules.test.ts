import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BaselinesStore } from "@/mcp/shell-proxy/baselines";
import { EventsLogger } from "@/mcp/shell-proxy/events";
import { SessionStatsStore } from "@/mcp/shell-proxy/stats";
import { costUsd, estimateTokens } from "@/mcp/shell-proxy/tokens";
import { resolveProjectMcpCacheDir } from "@/mcp/resolve-mcp-cache-dir";

describe("mcp/shell-proxy modules", () => {
  it("estimateTokens uses JSON ratio for structured output", () => {
    const json = '{"a":1,"b":2,"c":3}';
    expect(estimateTokens(json)).toBeGreaterThan(0);
    expect(estimateTokens("hello world plain text")).toBeGreaterThan(0);
  });

  it("costUsd applies Sonnet pricing", () => {
    expect(costUsd(1_000_000, 0)).toBeCloseTo(3.0);
    expect(costUsd(0, 1_000_000)).toBeCloseTo(15.0);
  });

  it("BaselinesStore rolling average updates on each sample", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-bl-"));
    const store = new BaselinesStore(join(dir, "_baselines.json"));
    expect(store.getBaseline("wf_state")).toBe(480);
    store.updateBaseline("wf_state", 100);
    store.updateBaseline("wf_state", 200);
    expect(store.getBaseline("wf_state")).toBe(150);
  });

  it("EventsLogger appends JSONL rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-ev-"));
    const eventsFile = join(dir, "events.jsonl");
    const stats = new SessionStatsStore(join(dir, "session-stats.json"));
    const logger = new EventsLogger(eventsFile, "wf-test", "Test", stats);
    logger.logEvent({ type: "mcp", tool: "wf_state", output_tokens: 10 });
    const lines = (await readFile(eventsFile, "utf-8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    const row = JSON.parse(lines[0]!) as { project_id: string; tool: string };
    expect(row.project_id).toBe("wf-test");
    expect(row.tool).toBe("wf_state");
  });

  it("SessionStatsStore initSessionStats resets current_session", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-st-"));
    const statsFile = join(dir, "session-stats.json");
    await writeFile(
      statsFile,
      JSON.stringify({ current_session: { consumed: 99, saved: 1 } }),
      "utf-8",
    );
    const store = new SessionStatsStore(statsFile);
    store.initSessionStats();
    const raw = JSON.parse(await readFile(statsFile, "utf-8")) as {
      current_session: { consumed: number };
    };
    expect(raw.current_session.consumed).toBe(0);
  });

  it("resolveProjectMcpCacheDir honors FLOWCTL_CACHE_DIR", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-cache-dir-"));
    const custom = join(dir, "custom-cache");
    expect(resolveProjectMcpCacheDir(dir, { FLOWCTL_CACHE_DIR: custom })).toBe(
      custom,
    );
  });
});
