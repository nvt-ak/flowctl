import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanMercenaryRequests } from "@/commands/mercenary/scan";

describe("scanMercenaryRequests", () => {
  it("returns empty when reports dir missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-merc-"));
    const requests = await scanMercenaryRequests(
      join(root, "missing"),
      root,
    );
    expect(requests).toEqual([]);
  });

  it("detects NEEDS_SPECIALIST block", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-merc-"));
    const reportsDir = join(root, "reports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      join(reportsDir, "backend-report.md"),
      [
        "## NEEDS_SPECIALIST",
        "- type: researcher",
        '  query: "OAuth providers"',
        '  blocking: "Cannot pick library"',
      ].join("\n"),
      "utf-8",
    );
    const requests = await scanMercenaryRequests(reportsDir, root);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      type: "researcher",
      requested_by: "backend",
    });
  });
});
