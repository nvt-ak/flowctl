/** Set value at dot-path, creating intermediate objects as needed. */
export function setAtPath(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): void {
  const keys = dotPath.split(".");
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    const next = cursor[k];
    if (next === undefined || next === null || typeof next !== "object") {
      cursor[k] = {};
    }
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]!] = value;
}

/** Append item to array at dot-path. */
export function appendAtPath(
  obj: Record<string, unknown>,
  dotPath: string,
  item: unknown,
): void {
  const keys = dotPath.split(".");
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    const next = cursor[k];
    if (next === undefined || typeof next !== "object" || next === null) {
      throw new Error(`Invalid append path (missing segment): ${dotPath}`);
    }
    cursor = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1]!;
  const existing = cursor[last];
  if (Array.isArray(existing)) {
    existing.push(item);
  } else if (existing === undefined) {
    cursor[last] = [item];
  } else {
    cursor[last] = [existing, item];
  }
}
