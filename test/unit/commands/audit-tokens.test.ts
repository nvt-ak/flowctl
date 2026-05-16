import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAuditTokens } from "@/commands/audit-tokens";
import * as tokenAudit from "@/integrations/token-audit";
import { makeCtx } from "../../helpers/ctx";

const sampleStats = {
  total_calls: 2,
  total_tokens: 110,
  saved_tokens: 5,
  overhead_tokens: 10,
  work_tokens: 100,
  overhead_pct: 9.09,
  total_cost_usd: 0.01,
  saved_cost_usd: 0,
  cache_hits: 1,
  cache_misses: 1,
  hit_rate: 50,
  per_tool: {
    wf_state: { calls: 1, tokens: 10, saved: 0, hits: 0, misses: 1, cost_usd: 0 },
    custom_tool: {
      calls: 1,
      tokens: 100,
      saved: 5,
      hits: 1,
      misses: 0,
      cost_usd: 0.01,
    },
  },
};

const sampleRows = [
  {
    task: "t1",
    tier: "MICRO",
    total_tokens: 110,
    overhead_tokens: 10,
    work_tokens: 100,
    calls: 2,
    ratio: 0.1,
  },
];

describe("commands/audit-tokens", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns when events file is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(tokenAudit, "loadEventsFromFile").mockResolvedValue([]);

    await makeCtx(async (ctx) => {
      await runAuditTokens(ctx, {});
    });

    expect(warn.mock.calls.some((c) => String(c[0]).includes("events.jsonl"))).toBe(
      true,
    );
    warn.mockRestore();
    log.mockRestore();
  });

  it("prints table format with summary", async () => {
    vi.spyOn(tokenAudit, "loadEventsFromFile").mockResolvedValue([
      { tool: "wf_state", output_tokens: 10 },
    ]);
    vi.spyOn(tokenAudit, "analyze").mockReturnValue(sampleStats);
    vi.spyOn(tokenAudit, "analyzeByTask").mockReturnValue(sampleRows);
    vi.spyOn(tokenAudit, "loadSessionStats").mockResolvedValue({});
    vi.spyOn(tokenAudit, "graphifyStatus").mockReturnValue({
      status: "OK",
      nodes: 100,
      relationships: 200,
    });

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await mkdir(dirname(ctx.paths.eventsFile), { recursive: true });
      await writeFile(
        ctx.paths.eventsFile,
        `${JSON.stringify({ tool: "wf_state", output_tokens: 10 })}\n`,
        "utf-8",
      );
      await runAuditTokens(ctx, { format: "table" });
    });

    const out = logs.join("\n");
    expect(out).toContain("Token Audit Report");
    expect(out).toContain("t1");
    expect(out).toContain("Overhead breakdown");
    log.mockRestore();
  });

  it("prints markdown format", async () => {
    vi.spyOn(tokenAudit, "loadEventsFromFile").mockResolvedValue([{ tool: "a" }]);
    vi.spyOn(tokenAudit, "analyze").mockReturnValue(sampleStats);
    vi.spyOn(tokenAudit, "analyzeByTask").mockReturnValue(sampleRows);
    vi.spyOn(tokenAudit, "loadSessionStats").mockResolvedValue({});
    vi.spyOn(tokenAudit, "graphifyStatus").mockReturnValue({
      status: "MISSING",
      nodes: 0,
      relationships: 0,
    });

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await mkdir(dirname(ctx.paths.eventsFile), { recursive: true });
      await writeFile(ctx.paths.eventsFile, "{}\n", "utf-8");
      await runAuditTokens(ctx, { format: "markdown" });
    });

    expect(logs.join("\n")).toContain("| Task | Tier |");
    log.mockRestore();
  });

  it("prints json payload when --json", async () => {
    const payload = { stats: sampleStats, tasks: sampleRows };
    vi.spyOn(tokenAudit, "loadEventsFromFile").mockResolvedValue([{ tool: "a" }]);
    vi.spyOn(tokenAudit, "analyze").mockReturnValue(sampleStats);
    vi.spyOn(tokenAudit, "analyzeByTask").mockReturnValue(sampleRows);
    vi.spyOn(tokenAudit, "loadSessionStats").mockResolvedValue({});
    vi.spyOn(tokenAudit, "graphifyStatus").mockReturnValue({
      status: "OK",
      nodes: 10,
      relationships: 20,
    });
    vi.spyOn(tokenAudit, "buildJsonPayload").mockReturnValue(payload);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await mkdir(dirname(ctx.paths.eventsFile), { recursive: true });
      await writeFile(ctx.paths.eventsFile, "{}\n", "utf-8");
      await runAuditTokens(ctx, { json: true });
    });

    expect(logs.some((l) => l.includes('"stats"'))).toBe(true);
    log.mockRestore();
  });

  it("prints legacy report for unknown format", async () => {
    vi.spyOn(tokenAudit, "loadEventsFromFile").mockResolvedValue([{ tool: "a" }]);
    vi.spyOn(tokenAudit, "analyze").mockReturnValue(sampleStats);
    vi.spyOn(tokenAudit, "analyzeByTask").mockReturnValue(sampleRows);
    vi.spyOn(tokenAudit, "loadSessionStats").mockResolvedValue({
      bash_waste_tokens: 6000,
      bash_calls: 3,
    });
    vi.spyOn(tokenAudit, "graphifyStatus").mockReturnValue({
      status: "MISSING",
      nodes: 0,
      relationships: 0,
    });

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await mkdir(dirname(ctx.paths.eventsFile), { recursive: true });
      await writeFile(ctx.paths.eventsFile, "{}\n", "utf-8");
      await runAuditTokens(ctx, { format: "legacy" });
    });

    const out = logs.join("\n");
    expect(out).toContain("flowctl Token Audit");
    expect(out).toContain("Recommendations");
    log.mockRestore();
  });

  it("--skill-sizes prints manifest table or warns when missing", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await makeCtx(async (ctx) => {
      await runAuditTokens(ctx, { skillSizes: true });
    });

    expect(error.mock.calls.length + logs.length).toBeGreaterThan(0);
    log.mockRestore();
    error.mockRestore();
  });
});
