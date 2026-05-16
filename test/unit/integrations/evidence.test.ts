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
    if (!bad.ok) {
      expect(bad.errors.some((e) => e.startsWith("checksum_mismatch:"))).toBe(true);
    }
  });

  it("reports manifest_hash_mismatch when manifest hash field is tampered", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ev-hash-"));
    const repo = join(tmp, "repo");
    const dispatchBase = join(repo, "workflows", "ab", "dispatch");
    const reportsDir = join(dispatchBase, "step-1", "reports");
    await mkdir(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, "dev-report.md");
    await writeFile(reportPath, "stable content\n", "utf-8");

    const evidenceDir = join(tmp, "runtime", "evidence");
    const manifestPath = await captureStepEvidence({
      step: 1,
      repoRoot: repo,
      evidenceDir,
      dispatchBase,
    });

    const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as {
      manifest_hash: string;
      signature: string;
    };
    manifest.manifest_hash = "tampered";
    manifest.signature = "sha256:tampered";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const bad = await verifyStepEvidence({
      step: 1,
      repoRoot: repo,
      manifestPath,
      dispatchBase,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors).toContain("manifest_hash_mismatch");
    }
  });
});
