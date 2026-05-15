import { readdir, readFile } from "node:fs/promises";
import { relative } from "node:path";
import { pathExists } from "@/utils/fs";

export type MercenaryRequest = {
  type: string;
  query?: string;
  blocking?: string;
  priority?: string;
  requested_by: string;
  report: string;
};

const TYPE_RE = /^-\s+type:\s+(.+)$/;

/** Port of wf_mercenary_scan in mercenary.sh */
export async function scanMercenaryRequests(
  reportsDir: string,
  repoRoot: string,
): Promise<MercenaryRequest[]> {
  if (!(await pathExists(reportsDir))) return [];

  const requests: MercenaryRequest[] = [];
  const names = (await readdir(reportsDir)).filter((n) => n.endsWith("-report.md"));
  names.sort();

  for (const name of names) {
    const reportFile = `${reportsDir}/${name}`;
    const role = name.replace(/-report\.md$/, "");
    const content = await readFile(reportFile, "utf-8");
    let inBlock = false;
    let current: Partial<MercenaryRequest> = {};

    const flush = () => {
      if (current.type) {
        requests.push({
          type: current.type,
          query: current.query,
          blocking: current.blocking,
          priority: current.priority,
          requested_by: role,
          report: relative(repoRoot, reportFile),
        });
      }
      current = {};
    };

    for (const line of content.split("\n")) {
      const stripped = line.trim();
      if (stripped === "## NEEDS_SPECIALIST") {
        inBlock = true;
        continue;
      }
      if (inBlock) {
        if (stripped.startsWith("## ") && stripped !== "## NEEDS_SPECIALIST") {
          flush();
          inBlock = false;
          continue;
        }
        const typeMatch = TYPE_RE.exec(stripped);
        if (typeMatch) {
          flush();
          current = { type: typeMatch[1]!.trim() };
          continue;
        }
        if (current.type) {
          const bare = stripped.replace(/^-\s+/, "");
          for (const key of ["query", "blocking", "priority"] as const) {
            const m = new RegExp(`^${key}:\\s+"?(.+?)"?\\s*$`).exec(bare);
            if (m) current[key] = m[1]!.trim();
          }
        }
      }
    }
    if (inBlock && current.type) flush();
  }

  return requests;
}
