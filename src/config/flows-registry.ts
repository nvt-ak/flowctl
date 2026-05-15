import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withNamedDirLock } from "@/utils/lock";
import { pathExists } from "@/utils/fs";
import { z } from "zod";

const FlowMetaSchema = z.object({
  state_file: z.string(),
  label: z.string().optional().default(""),
});

export const FlowsIndexSchema = z.object({
  version: z.number().default(1),
  active_flow_id: z.string().optional().default(""),
  flows: z.record(z.string(), FlowMetaSchema).default({}),
});

export type FlowsIndex = z.infer<typeof FlowsIndexSchema>;

export function flowsJsonPath(projectRoot: string): string {
  return join(projectRoot, ".flowctl", "flows.json");
}

export function flowsIndexLockPath(projectRoot: string): string {
  return join(projectRoot, ".flowctl", "flows.new.lock");
}

export async function readFlowsIndex(
  projectRoot: string,
): Promise<FlowsIndex | null> {
  const path = flowsJsonPath(projectRoot);
  if (!(await pathExists(path))) return null;
  const raw = JSON.parse(await readFile(path, "utf-8"));
  return FlowsIndexSchema.parse(raw);
}

export async function withFlowsIndexLock<T>(
  projectRoot: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withNamedDirLock(flowsIndexLockPath(projectRoot), fn, {
    maxRetries: 40,
    baseDelayMs: 25,
  });
}

export async function writeFlowsIndex(
  projectRoot: string,
  index: FlowsIndex,
): Promise<void> {
  const path = flowsJsonPath(projectRoot);
  await mkdir(join(projectRoot, ".flowctl"), { recursive: true });
  await writeFile(path, `${JSON.stringify(index, null, 2)}\n`, "utf-8");
}

export async function mutateFlowsIndex(
  projectRoot: string,
  mutator: (index: FlowsIndex) => void,
): Promise<FlowsIndex> {
  return withFlowsIndexLock(projectRoot, async () => {
    const path = flowsJsonPath(projectRoot);
    let index: FlowsIndex;
    if (await pathExists(path)) {
      const raw = JSON.parse(await readFile(path, "utf-8"));
      index = FlowsIndexSchema.parse(raw);
    } else {
      index = { version: 1, active_flow_id: "", flows: {} };
    }
    mutator(index);
    await writeFlowsIndex(projectRoot, index);
    return index;
  });
}

export function resolveFlowId(
  index: FlowsIndex,
  target: string,
): string | null {
  const flows = index.flows;
  if (target in flows) return target;

  const tnd = target.replace(/^wf-/, "").replace(/-/g, "");
  for (const k of Object.keys(flows)) {
    const knd = k.replace(/^wf-/, "").replace(/-/g, "");
    if (
      k === target ||
      k.startsWith(target) ||
      (tnd && (knd.startsWith(tnd) || k.startsWith(`wf-${tnd.slice(0, 8)}`)))
    ) {
      return k;
    }
  }
  if (tnd) {
    for (const k of Object.keys(flows)) {
      const knd = k.replace(/^wf-/, "").replace(/-/g, "");
      if (knd.includes(tnd)) return k;
    }
  }
  return null;
}
