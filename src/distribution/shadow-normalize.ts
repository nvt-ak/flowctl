/**
 * Shadow-mode helpers: normalize stdout/stderr and workflow JSON so bash vs TS
 * runs can be compared (Phase 8 cutover).
 */

/** CSI / OSC-style ANSI sequences (bash color + chalk). */
const ANSI_ESCAPE = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\u0007]*\u0007)/g;

const ISO_TIMESTAMP =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?/g;

export function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE, "");
}

export function stripIsoTimestamps(input: string): string {
  return input.replace(ISO_TIMESTAMP, "<TIMESTAMP>");
}

export function stripFlowctlLogPrefixes(input: string): string {
  return input.replace(/^\[flowctl\]\s*/gm, "");
}

/** Per-line trailing whitespace (allowed drift). */
export function trimTrailingWhitespaceLines(input: string): string {
  return input.replace(/[ \t]+$/gm, "");
}

/**
 * Normalize CLI streams before diff: ANSI, ISO timestamps, `[flowctl]` prefixes,
 * trailing line whitespace, CRLF → LF.
 */
export function normalizeShadowStream(text: string): string {
  let s = stripAnsi(text);
  s = stripIsoTimestamps(s);
  s = stripFlowctlLogPrefixes(s);
  s = trimTrailingWhitespaceLines(s);
  return s.replace(/\r\n/g, "\n");
}

/** Deep-sort object keys; preserve array order (semantic order for blockers, etc.). */
export function stableSortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableSortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = stableSortKeys(obj[k]);
  }
  return out;
}

export function workflowStateJsonEquivalent(a: string, b: string): boolean {
  let pa: unknown;
  let pb: unknown;
  try {
    pa = JSON.parse(a) as unknown;
    pb = JSON.parse(b) as unknown;
  } catch {
    return false;
  }
  const sa = JSON.stringify(stableSortKeys(pa));
  const sb = JSON.stringify(stableSortKeys(pb));
  return sa === sb;
}
