import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathExists } from "@/utils/fs";

export type RegistryProject = {
  project_id: string;
  project_name: string;
  path: string;
  cache_dir?: string;
  runtime_dir?: string;
  current_step?: number;
  overall_status?: string;
  open_blockers?: number;
  last_seen: string;
};

export type FlowctlRegistry = {
  version: number;
  projects: Record<string, RegistryProject>;
};

const EMPTY_REGISTRY: FlowctlRegistry = { version: 1, projects: {} };

/** Read ~/.flowctl/registry.json with safe defaults. */
export async function readRegistry(registryFile: string): Promise<FlowctlRegistry> {
  if (!(await pathExists(registryFile))) {
    return { ...EMPTY_REGISTRY, projects: {} };
  }
  try {
    const raw = JSON.parse(await readFile(registryFile, "utf-8")) as FlowctlRegistry;
    return {
      version: raw.version ?? 1,
      projects: raw.projects ?? {},
    };
  } catch {
    return { ...EMPTY_REGISTRY, projects: {} };
  }
}

/** Upsert project entry (port of shell-proxy registryUpsert core). */
export async function upsertRegistryProject(
  registryFile: string,
  projectId: string,
  entry: RegistryProject,
): Promise<void> {
  const registry = await readRegistry(registryFile);
  registry.projects[projectId] = {
    ...entry,
    last_seen: entry.last_seen || new Date().toISOString(),
  };

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [id, p] of Object.entries(registry.projects)) {
    if (new Date(p.last_seen).getTime() < cutoff) {
      delete registry.projects[id];
    }
  }

  await mkdir(dirname(registryFile), { recursive: true });
  const tmp = `${registryFile}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(registry, null, 2), "utf-8");
  await rename(tmp, registryFile);
}
