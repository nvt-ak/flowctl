import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureStreamJson, extractStreamText } from "@/integrations/stream-capture";

describe("stream-capture", () => {
  it("extractStreamText reads nested data.text", () => {
    expect(
      extractStreamText({ data: { text: "hello" } }),
    ).toBe("hello");
  });

  it("captureStreamJson writes log and heartbeat files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-stream-"));
    const logPath = join(dir, "agent.log");
    const hbPath = join(dir, "heartbeats.jsonl");

    const result = await captureStreamJson(
      [
        '{"type":"delta","text":"Hi"}',
        "plain log line",
        "not json",
      ],
      {
        step: 2,
        role: "pm",
        flowctlId: "wf-abc",
        runId: "run-1",
        logPath,
        heartbeatsPath: hbPath,
      },
    );

    expect(result.heartbeats).toBe(1);
    expect(result.logLines).toBe(3);
    const log = await readFile(logPath, "utf-8");
    expect(log).toContain("Hi");
    expect(log).toContain("plain log line");
    const hb = await readFile(hbPath, "utf-8");
    expect(hb).toContain('"event_type":"delta"');
  });
});
