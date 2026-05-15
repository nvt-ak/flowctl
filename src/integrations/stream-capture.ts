import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type StreamCaptureOpts = {
  step: number;
  role: string;
  flowctlId: string;
  runId: string;
  logPath: string;
  heartbeatsPath: string;
};

export type StreamCaptureResult = {
  logLines: number;
  heartbeats: number;
};

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Best-effort text extraction from stream-json payloads. */
export function extractStreamText(payload: Record<string, unknown>): string {
  for (const key of ["text", "delta", "content", "message"] as const) {
    const val = payload[key];
    if (typeof val === "string" && val) return val;
  }
  const data = payload.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["text", "delta", "content", "message"] as const) {
      const val = d[key];
      if (typeof val === "string" && val) return val;
    }
  }
  return "";
}

/** Port of stream_json_capture.py — process newline-delimited stdin chunks. */
export async function captureStreamJson(
  lines: string[],
  opts: StreamCaptureOpts,
): Promise<StreamCaptureResult> {
  await mkdir(dirname(opts.logPath), { recursive: true });
  await mkdir(dirname(opts.heartbeatsPath), { recursive: true });

  let logLines = 0;
  let heartbeats = 0;

  for (const raw of lines) {
    const line = raw.replace(/\n$/, "");
    const ts = utcNow();
    let parsed: Record<string, unknown> | null = null;
    try {
      const val = JSON.parse(line) as unknown;
      parsed = val !== null && typeof val === "object" && !Array.isArray(val)
        ? (val as Record<string, unknown>)
        : null;
    } catch {
      parsed = null;
    }

    if (parsed === null) {
      if (line) {
        await appendFile(opts.logPath, `${line}\n`, "utf-8");
        logLines += 1;
      }
      continue;
    }

    const eventType = String(
      parsed.type ?? parsed.event ?? parsed.kind ?? "unknown",
    );
    const text = extractStreamText(parsed);
    const heartbeat = {
      timestamp: ts,
      flow_id: opts.flowctlId,
      run_id: opts.runId,
      correlation_id: `${opts.flowctlId}/${opts.runId}/${opts.step}/${opts.role}`,
      step: opts.step,
      role: opts.role,
      event_type: eventType,
      has_text: Boolean(text),
    };
    await appendFile(
      opts.heartbeatsPath,
      `${JSON.stringify(heartbeat)}\n`,
      "utf-8",
    );
    heartbeats += 1;

    if (text) {
      const suffix = text.endsWith("\n") ? "" : "\n";
      await appendFile(opts.logPath, `${text}${suffix}`, "utf-8");
      logLines += 1;
    }
  }

  return { logLines, heartbeats };
}
