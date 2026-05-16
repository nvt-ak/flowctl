import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTokenReportMarkdown,
  resolveDispatchBaseDir,
  resolveReportStep,
  runGenerateTokenReport,
} from "@/hooks/token-report";

describe("hooks/token-report", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolveReportStep uses explicit --step", () => {
    expect(resolveReportStep({ explicitStep: 4, currentStep: 9 })).toBe(4);
  });

  it("resolveReportStep uses current_step-1 when step not passed and step>1", () => {
    expect(resolveReportStep({ explicitStep: undefined, currentStep: 3 })).toBe(2);
  });

  it("resolveReportStep uses current_step when step is 0 or 1", () => {
    expect(resolveReportStep({ explicitStep: undefined, currentStep: 1 })).toBe(1);
    expect(resolveReportStep({ explicitStep: undefined, currentStep: 0 })).toBe(0);
  });

  it("resolveDispatchBaseDir prefers WF_DISPATCH_BASE", () => {
    const repo = "/repo";
    expect(resolveDispatchBaseDir(repo, { WF_DISPATCH_BASE: "/custom/dispatch" })).toBe(
      "/custom/dispatch",
    );
  });

  it("resolveDispatchBaseDir uses workflows/{short}/dispatch when flow_id wf-*", () => {
    const repo = join(tmpdir(), "flowctl-dispatch-test");
    expect(resolveDispatchBaseDir(repo, {}, { flow_id: "wf-abcdefgh-extra" })).toBe(
      join(repo, "workflows", "abcdefgh", "dispatch"),
    );
  });

  it("resolveDispatchBaseDir falls back to workflows/dispatch", () => {
    const repo = "/r";
    expect(resolveDispatchBaseDir(repo, {})).toBe(join("/r", "workflows", "dispatch"));
  });

  it("buildTokenReportMarkdown includes summary table", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00Z"));
    const md = buildTokenReportMarkdown({
      step: 2,
      stepName: "Design",
      stats: {
        tools: {
          wf_state: { calls: 10, hits: 2, saved: 100 },
        },
        total_consumed_tokens: 1000,
        total_saved_tokens: 200,
        total_cost_usd: 0.05,
        total_saved_usd: 0.01,
        bash_waste_tokens: 42,
      },
      events: [],
      nowLabel: undefined,
    });
    expect(md).toContain("# Token Report — Step 2: Design");
    expect(md).toContain("2026-05-16");
    expect(md).toContain("~1,000 tokens");
    expect(md).toContain("wf_state");
  });

  it("buildTokenReportMarkdown lists bash waste", () => {
    const md = buildTokenReportMarkdown({
      step: 1,
      stepName: "Step 1",
      stats: { tools: {} },
      events: [
        {
          type: "bash",
          cmd: "cat README.md",
          waste_tokens: 500,
          suggestion: "wf_read",
        },
      ],
      nowLabel: "fixed",
    });
    expect(md).toContain("Top Token Waste");
    expect(md).toContain("cat README.md");
    expect(md).toContain("wf_read");
  });

  it("runGenerateTokenReport writes report and archives stats", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T15:00:00.000Z"));
    const repo = await mkdtemp(join(tmpdir(), "flowctl-tr-"));
    const cache = join(repo, ".cache", "mcp");
    await mkdir(cache, { recursive: true });
    const statsPath = join(cache, "session-stats.json");
    await writeFile(
      statsPath,
      JSON.stringify({
        tools: { t1: { calls: 3, hits: 1, saved: 10 } },
        total_consumed_tokens: 100,
        total_saved_tokens: 50,
        total_cost_usd: 0,
        total_saved_usd: 0,
        bash_waste_tokens: 0,
      }),
      "utf-8",
    );
    const statePath = join(repo, "flowctl-state.json");
    await writeFile(
      statePath,
      JSON.stringify({ current_step: 2, steps: { "1": { name: "Req" } } }),
      "utf-8",
    );

    const lines = await runGenerateTokenReport({
      repoRoot: repo,
      env: {
        FLOWCTL_CACHE_DIR: cache,
        FLOWCTL_EVENTS_F: join(cache, "events.jsonl"),
        FLOWCTL_STATS_F: statsPath,
        FLOWCTL_STATE_FILE: statePath,
      },
      explicitStep: 1,
    });

    expect(lines.some((l) => l.includes("Token report:"))).toBe(true);
    const reportPath = join(repo, "workflows", "dispatch", "step-1", "token-report.md");
    const body = await readFile(reportPath, "utf-8");
    expect(body).toContain("Step 1: Req");
    const archived = join(cache, "session-stats-step1.json");
    expect(await readFile(archived, "utf-8")).toContain("total_consumed_tokens");
    const nextStats = JSON.parse(await readFile(statsPath, "utf-8")) as { previous_step?: number };
    expect(nextStats.previous_step).toBe(1);
  });
});
