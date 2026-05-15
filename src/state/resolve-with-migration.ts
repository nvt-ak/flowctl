import { resolve } from "node:path";
import { migrateLegacyState } from "@/state/migrate";
import { pathExists } from "@/utils/fs";
import {
  resolveStatePath,
  type ResolveEnv,
  type ResolveResult,
} from "@/state/resolver";

/** Resolver + legacy migrate (config.sh parity). */
export async function resolveStatePathWithMigration(
  projectRoot: string,
  env: ResolveEnv = process.env as ResolveEnv,
  opts?: { flowctlHome?: string },
): Promise<ResolveResult> {
  const first = await resolveStatePath(projectRoot, env, opts);
  if (first.source !== "not_initialized") {
    return first;
  }

  const repo = resolve(projectRoot);
  const rootState = resolve(repo, "flowctl-state.json");
  if (!(await pathExists(rootState))) {
    return first;
  }

  const migrated = await migrateLegacyState(repo);
  if (migrated) {
    return { stateFile: migrated, source: "migrated_legacy" };
  }

  return first;
}
