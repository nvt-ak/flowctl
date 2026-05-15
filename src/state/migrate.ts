import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathExists } from "@/utils/fs";

/** One-time migration: root flowctl-state.json → .flowctl/flows/<short>/state.json */
export async function migrateLegacyState(
  repoRoot: string,
): Promise<string | null> {
  const repo = resolve(repoRoot);
  const flowsP = resolve(repo, ".flowctl", "flows.json");
  if (await pathExists(flowsP)) {
    return null;
  }

  const root = resolve(repo, "flowctl-state.json");
  if (!(await pathExists(root))) {
    return null;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(await readFile(root, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }

  const fid = String(data.flow_id ?? "").trim();
  if (!fid || !fid.startsWith("wf-")) {
    return null;
  }

  const short = fid.replace("wf-", "").replace(/-/g, "").slice(0, 8) || "legacy";
  const destDir = resolve(repo, ".flowctl", "flows", short);
  const dest = resolve(destDir, "state.json");
  if (await pathExists(dest)) {
    return null;
  }

  await mkdir(destDir, { recursive: true });
  try {
    await rename(root, dest);
  } catch {
    return null;
  }

  const rel = dest.slice(repo.length + 1);
  const idx = {
    version: 1,
    active_flow_id: fid,
    flows: { [fid]: { state_file: rel, label: "migrated-root" } },
  };
  await mkdir(resolve(repo, ".flowctl"), { recursive: true });
  await writeFile(flowsP, JSON.stringify(idx, null, 2) + "\n", "utf-8");
  return dest;
}
