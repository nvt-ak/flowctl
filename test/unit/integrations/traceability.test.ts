import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendTraceabilityEvent } from "@/integrations/traceability";

describe("appendTraceabilityEvent", () => {
  it("appends JSONL and deduplicates by event_id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-trace-"));
    const file = join(dir, "trace.jsonl");
    const payload = { step: "1", role: "pm" };

    const first = await appendTraceabilityEvent(file, "evt-1", "task", payload);
    expect(first).toBe("added");
    const second = await appendTraceabilityEvent(file, "evt-1", "task", payload);
    expect(second).toBe("skipped");

    const lines = (await readFile(file, "utf-8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    const row = JSON.parse(lines[0]!) as { event_id: string; event_type: string };
    expect(row.event_id).toBe("evt-1");
    expect(row.event_type).toBe("task");
  });
});
