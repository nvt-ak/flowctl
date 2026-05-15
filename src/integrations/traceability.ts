import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathExists } from "@/utils/fs";

export type TraceAppendResult = "added" | "skipped";

/** Port of wf_traceability_append_event (traceability.sh). */
export async function appendTraceabilityEvent(
  traceabilityFile: string,
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<TraceAppendResult> {
  const existingIds = new Set<string>();
  if (await pathExists(traceabilityFile)) {
    const text = await readFile(traceabilityFile, "utf-8");
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try {
        const row = JSON.parse(s) as { event_id?: string };
        if (row.event_id) existingIds.add(row.event_id);
      } catch {
        /* ignore malformed lines */
      }
    }
  }

  if (existingIds.has(eventId)) {
    return "skipped";
  }

  const row = {
    event_id: eventId,
    event_type: eventType,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    ...payload,
  };

  await mkdir(dirname(traceabilityFile), { recursive: true });
  await appendFile(traceabilityFile, `${JSON.stringify(row)}\n`, "utf-8");
  return "added";
}
