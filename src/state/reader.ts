import { readFile } from "node:fs/promises";
import {
  FlowctlStateSchema,
  normalizeRaw,
  type FlowctlState,
} from "@/state/schema";
import { defaultState } from "@/state/default-state";
import { pathExists } from "@/utils/fs";

export type ReadStateResult =
  | { ok: true; data: FlowctlState }
  | { ok: false; error: string };

export async function readState(path: string): Promise<ReadStateResult> {
  if (!(await pathExists(path))) {
    return { ok: false, error: `State file not found: ${path}` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return { ok: false, error: `Invalid JSON in state file: ${path}` };
  }

  const parsed = FlowctlStateSchema.safeParse(normalizeRaw(raw));
  if (!parsed.success) {
    return {
      ok: false,
      error: `State schema validation failed: ${parsed.error.message}`,
    };
  }
  return { ok: true, data: parsed.data };
}

export async function readStateOrDefault(path: string): Promise<FlowctlState> {
  const result = await readState(path);
  if (result.ok) return result.data;
  return defaultState();
}

export function getPath(state: FlowctlState, dotPath: string): unknown {
  const keys = dotPath.split(".");
  let val: unknown = state;
  for (const k of keys) {
    if (val === null || val === undefined || typeof val !== "object") {
      return undefined;
    }
    val = (val as Record<string, unknown>)[k];
  }
  return val;
}
