import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyze,
  analyzeByTask,
  buildJsonPayload,
  eventTaskKey,
  graphifyStatus,
  inferTier,
  loadEventsFromLines,
  loadSessionStats,
  OVERHEAD_TOOLS,
  parseSkillManifestForSizes,
} from "@/integrations/token-audit";

describe("token-audit", () => {
  it("OVERHEAD_TOOLS includes wf_state and graphify-style names", () => {
    expect(OVERHEAD_TOOLS.has("wf_state")).toBe(true);
    expect(OVERHEAD_TOOLS.has("query_graph")).toBe(true);
  });

  it("analyze empty events", () => {
    const s = analyze([]);
    expect(s.total_calls).toBe(0);
    expect(s.total_tokens).toBe(0);
    expect(s.hit_rate).toBe(0);
    expect(Object.keys(s.per_tool)).toHaveLength(0);
  });

  it("analyze splits overhead vs work and cache hits", () => {
    const events = [
      { tool: "wf_state", output_tokens: 10, saved_tokens: 0, cost_usd: 0, saved_usd: 0, cache: "miss" },
      { tool: "custom_tool", output_tokens: 100, saved_tokens: 5, cost_usd: 0.01, saved_usd: 0, cache: "hit" },
    ];
    const s = analyze(events);
    expect(s.total_calls).toBe(2);
    expect(s.total_tokens).toBe(110);
    expect(s.overhead_tokens).toBe(10);
    expect(s.work_tokens).toBe(100);
    expect(s.cache_hits).toBe(1);
    expect(s.cache_misses).toBe(1);
    expect(s.per_tool.wf_state?.calls).toBe(1);
    expect(s.per_tool.custom_tool?.hits).toBe(1);
  });

  it("inferTier boundaries", () => {
    expect(inferTier(1500)).toBe("MICRO");
    expect(inferTier(1501)).toBe("STANDARD");
    expect(inferTier(12000)).toBe("STANDARD");
    expect(inferTier(12001)).toBe("FULL");
  });

  it("eventTaskKey prefers task_id", () => {
    expect(eventTaskKey({ task_id: "t1", ts: "2026-01-01T00:00:00Z" })).toBe("t1");
    expect(eventTaskKey({ run_id: "r2" })).toBe("r2");
  });

  it("loadEventsFromLines filters by step", () => {
    const lines = [
      JSON.stringify({ tool: "a", step: 1, output_tokens: 1 }),
      JSON.stringify({ tool: "b", step: 2, output_tokens: 2 }),
    ];
    const ev = loadEventsFromLines(lines.join("\n"), { step: 2 });
    expect(ev).toHaveLength(1);
    expect(ev[0]?.tool).toBe("b");
  });

  it("loadEventsFromLines filters by days with fixed now", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const old = JSON.stringify({
      tool: "x",
      ts: "2026-05-01T00:00:00Z",
      output_tokens: 1,
    });
    const recent = JSON.stringify({
      tool: "y",
      ts: "2026-05-10T10:00:00Z",
      output_tokens: 2,
    });
    const ev = loadEventsFromLines([old, recent].join("\n"), { days: 2, now });
    expect(ev.map((e) => e.tool)).toEqual(["y"]);
  });

  it("graphifyStatus handles missing and OK graph", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-graph-"));
    expect(graphifyStatus(join(dir, "none.json")).status).toBe("MISSING");

    const okPath = join(dir, "ok.json");
    await writeFile(
      okPath,
      JSON.stringify({ nodes: { a: {}, b: {} }, relationships: [{ x: 1 }] }),
      "utf-8",
    );
    const ok = graphifyStatus(okPath);
    expect(ok.status).toBe("OK");
    expect(ok.nodes).toBe(2);
    expect(ok.relationships).toBe(1);
  });

  it("loadSessionStats returns {} on missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-stats-"));
    await expect(loadSessionStats(join(dir, "nope.json"))).resolves.toEqual({});
  });

  it("analyzeByTask aggregates and ratio", () => {
    const events = [
      { tool: "wf_state", output_tokens: 10, task_id: "A" },
      { tool: "work", output_tokens: 20, task_id: "A" },
    ];
    const rows = analyzeByTask(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.task).toBe("A");
    expect(rows[0]?.overhead_tokens).toBe(10);
    expect(rows[0]?.work_tokens).toBe(20);
    expect(rows[0]?.ratio).toBe(0.5);
  });

  it("parseSkillManifestForSizes counts lines from manifest entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-skillsz-"));
    const core = join(dir, ".cursor", "skills", "core");
    await mkdir(core, { recursive: true });
    const compact = join(core, "SKILL.md");
    await writeFile(compact, "a\nb\nc\n", "utf-8");
    const lazyDir = join(core, "refs");
    await mkdir(lazyDir, { recursive: true });
    const lazy1 = join(lazyDir, "x.md");
    await writeFile(lazy1, "l1\nl2\n", "utf-8");
    const manifest = {
      skills_with_detail: [
        {
          id: "test-skill",
          compact: ".cursor/skills/core/SKILL.md",
          lazy: [".cursor/skills/core/refs/x.md"],
        },
      ],
    };
    const manPath = join(core, "manifest.json");
    await writeFile(manPath, JSON.stringify(manifest), "utf-8");
    const rows = await parseSkillManifestForSizes(dir, manPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("test-skill");
    expect(rows[0]?.compactLines).toBe(3);
    expect(rows[0]?.lazyLines).toBe(2);
    expect(rows[0]?.lazyFragments).toBe(1);
  });

  it("parseSkillManifestForSizes marks missing compact/lazy entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-skillsz-miss-"));
    const manPath = join(dir, "manifest.json");
    await writeFile(
      manPath,
      JSON.stringify({
        skills_with_detail: [
          { id: "broken", compact: 123, lazy: "not-array" },
          {
            id: "missing-files",
            compact: ".cursor/skills/nope/SKILL.md",
            lazy: [".cursor/skills/nope/refs/x.md"],
          },
        ],
      }),
      "utf-8",
    );
    const rows = await parseSkillManifestForSizes(dir, manPath);
    expect(rows.find((r) => r.id === "broken")?.missing).toBe(true);
    expect(rows.find((r) => r.id === "missing-files")?.missing).toBe(true);
  });

  it("buildJsonPayload omits per_tool and includes graphify + tasks", () => {
    const events = [{ tool: "wf_state", output_tokens: 5, cache: "hit", task_id: "t1" }];
    const stats = analyze(events);
    const tasks = analyzeByTask(events);
    const session = { bash_calls: 2 };
    const graph = { status: "MISSING" as const, nodes: 0, relationships: 0 };
    const payload = buildJsonPayload(stats, tasks, session, graph);
    expect(payload).not.toHaveProperty("per_tool");
    expect(payload.total_calls).toBe(1);
    expect(payload.tasks).toEqual(tasks);
    expect(payload.session).toEqual(session);
    expect(payload.graphify).toEqual(graph);
  });

  it("graphifyStatus returns CORRUPT for invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-graph-bad-"));
    const badPath = join(dir, "bad.json");
    await writeFile(badPath, "{broken", "utf-8");
    expect(graphifyStatus(badPath).status).toBe("CORRUPT");
  });
});
