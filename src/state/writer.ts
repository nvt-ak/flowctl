import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  FlowctlStateSchema,
  type FlowctlState,
} from "@/state/schema";
import { defaultState } from "@/state/default-state";
import { readState } from "@/state/reader";
import { appendAtPath, setAtPath } from "@/utils/dot-path";
import { atomicJsonWrite } from "@/utils/json";
import { pathExists } from "@/utils/fs";

function nowTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function mutateState(
  stateFile: string,
  mutator: (data: Record<string, unknown>) => void,
): Promise<void> {
  await atomicJsonWrite(
    stateFile,
    (current) => {
      const data = structuredClone(current) as Record<string, unknown>;
      mutator(data);
      data.updated_at = nowTimestamp();
      return FlowctlStateSchema.parse(data);
    },
    FlowctlStateSchema,
  );
}

export async function initStateFile(stateFile: string): Promise<void> {
  const dir = dirname(stateFile);
  await mkdir(dir, { recursive: true });
  const state = defaultState();
  const content = JSON.stringify(state, null, 2);
  try {
    const fh = await open(stateFile, "wx");
    try {
      await fh.writeFile(content, "utf-8");
    } finally {
      await fh.close();
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
  }
}

export async function setPath(
  stateFile: string,
  dotPath: string,
  value: unknown,
): Promise<void> {
  if (!(await pathExists(stateFile))) {
    await initStateFile(stateFile);
  }
  await mutateState(stateFile, (data) => {
    setAtPath(data, dotPath, value);
  });
}

export async function appendPath(
  stateFile: string,
  dotPath: string,
  item: unknown,
): Promise<void> {
  if (!(await pathExists(stateFile))) {
    await initStateFile(stateFile);
  }
  await mutateState(stateFile, (data) => {
    appendAtPath(data, dotPath, item);
  });
}

export async function writeState(
  stateFile: string,
  state: FlowctlState,
): Promise<void> {
  await mkdir(dirname(stateFile), { recursive: true });
  const parsed = FlowctlStateSchema.parse(state);
  await writeFile(stateFile, JSON.stringify(parsed, null, 2), "utf-8");
}

export async function getPathFromFile(
  stateFile: string,
  dotPath: string,
): Promise<unknown> {
  const result = await readState(stateFile);
  if (!result.ok) return undefined;
  const keys = dotPath.split(".");
  let val: unknown = result.data;
  for (const k of keys) {
    if (val === null || val === undefined || typeof val !== "object") {
      return undefined;
    }
    val = (val as Record<string, unknown>)[k];
  }
  return val;
}
