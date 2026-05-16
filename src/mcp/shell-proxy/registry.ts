import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename } from "node:path";

export type RegistryProject = {
  project_id: string;
  project_name: string;
  path: string;
  cache_dir: string;
  last_seen: string;
  current_step?: number;
  overall_status?: string;
  open_blockers?: number;
};

function sleepMs(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin — parity with shell-proxy.js */
  }
}

export class RegistryStore {
  constructor(
    private readonly registryFile: string,
    private readonly flowctlHome: string,
    private readonly stateFile: string,
    private readonly repo: string,
    private readonly cacheDir: string,
    private readonly projectId: string,
    private readonly projectName: string,
  ) {}

  private ensureHome(): void {
    if (!existsSync(this.flowctlHome)) {
      mkdirSync(this.flowctlHome, { recursive: true });
    }
  }

  readRegistry(): { version: number; projects: Record<string, RegistryProject> } {
    try {
      return existsSync(this.registryFile)
        ? (JSON.parse(readFileSync(this.registryFile, "utf-8")) as {
            version: number;
            projects: Record<string, RegistryProject>;
          })
        : { version: 1, projects: {} };
    } catch {
      return { version: 1, projects: {} };
    }
  }

  upsert(extra: Record<string, unknown> = {}): void {
    this.ensureHome();
    const lockFile = `${this.registryFile}.lock`;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const fd = openSync(lockFile, "wx");
        closeSync(fd);
        try {
          const registry = this.readRegistry();
          let meta: Record<string, unknown> = {};
          try {
            const s = JSON.parse(readFileSync(this.stateFile, "utf-8")) as {
              current_step?: number;
              overall_status?: string;
              project_name?: string;
              steps?: Record<string, { blockers?: { resolved?: boolean }[] }>;
            };
            const openBlockers = Object.values(s.steps ?? {})
              .flatMap((st) => st.blockers ?? [])
              .filter((b) => !b.resolved).length;
            meta = {
              current_step: s.current_step ?? 0,
              overall_status: s.overall_status ?? "unknown",
              project_name: s.project_name ?? this.projectName,
              open_blockers: openBlockers,
            };
          } catch {
            /* state unreadable */
          }

          registry.projects[this.projectId] = {
            project_id: this.projectId,
            project_name: this.projectName,
            path: this.repo,
            cache_dir: this.cacheDir,
            last_seen: new Date().toISOString(),
            ...meta,
            ...extra,
          } as RegistryProject;

          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          for (const [id, p] of Object.entries(registry.projects)) {
            if (new Date(p.last_seen).getTime() < cutoff) {
              delete registry.projects[id];
            }
          }

          const tmp = `${this.registryFile}.tmp.${process.pid}`;
          writeFileSync(tmp, JSON.stringify(registry, null, 2));
          renameSync(tmp, this.registryFile);
        } finally {
          try {
            unlinkSync(lockFile);
          } catch {
            /* ignore */
          }
        }
        return;
      } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code !== "EEXIST") return;
        sleepMs(10 * 2 ** attempt);
      }
    }
  }
}

export function readProjectIdentity(
  stateFile: string,
  repo: string,
): { id: string; name: string } {
  try {
    const s = existsSync(stateFile)
      ? (JSON.parse(readFileSync(stateFile, "utf-8")) as {
          flow_id?: string;
          project_name?: string;
        })
      : {};
    return {
      id:
        s.flow_id ||
        `path-${createHash("sha1").update(repo).digest("hex").slice(0, 8)}`,
      name: s.project_name || basename(repo),
    };
  } catch {
    return {
      id: `path-${createHash("sha1").update(repo).digest("hex").slice(0, 8)}`,
      name: basename(repo),
    };
  }
}
