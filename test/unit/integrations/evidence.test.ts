import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureStepEvidence, verifyStepEvidence } from "@/integrations/evidence";

describe("evidence", () => {
  it("captures and verifies dispatch report hashes", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ev-"));
    const repo = join(tmp, "repo");
    const dispatchBase = join(repo, "workflows", "ab", "dispatch");
    const reportsDir = join(dispatchBase, "step-2", "reports");
    await mkdir(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, "pm-report.md");
    await writeFile(reportPath, "# hello evidence\n", "utf-8");

    const evidenceDir = join(tmp, "runtime", "evidence");
    const manifestPath = await captureStepEvidence({
      step: 2,
      repoRoot: repo,
      evidenceDir,
      dispatchBase,
    });
    expect(manifestPath).toContain("step-2-manifest.json");

    const result = await verifyStepEvidence({
      step: 2,
      repoRoot: repo,
      manifestPath,
      dispatchBase,
    });
    expect(result.ok).toBe(true);

    await writeFile(reportPath, "# tampered\n", "utf-8");
    const bad = await verifyStepEvidence({
      step: 2,
      repoRoot: repo,
      manifestPath,
      dispatchBase,
    });
    expect(bad.ok).toBe(false);
  });
});
