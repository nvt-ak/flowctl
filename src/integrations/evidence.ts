import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathExists } from "@/utils/fs";

export type EvidenceFileEntry = {
  path: string;
  sha256: string;
  size: number;
  mtime: number;
};

export type EvidenceManifest = {
  step: number;
  generated_at: string;
  file_count: number;
  manifest_hash: string;
  signature: string;
  files: EvidenceFileEntry[];
};

function manifestPathFor(evidenceDir: string, step: number): string {
  return join(evidenceDir, `step-${step}-manifest.json`);
}

async function collectDispatchFiles(
  repoRoot: string,
  dispatchBase: string,
  step: number,
): Promise<EvidenceFileEntry[]> {
  const files: EvidenceFileEntry[] = [];
  const stepDir = join(dispatchBase, `step-${step}`);
  for (const sub of ["reports", "logs"] as const) {
    const dir = join(stepDir, sub);
    if (!(await pathExists(dir))) continue;
    const names = await readdir(dir);
    for (const name of names.sort()) {
      const fp = join(dir, name);
      const st = await stat(fp);
      if (!st.isFile()) continue;
      const content = await readFile(fp);
      files.push({
        path: relative(repoRoot, fp),
        sha256: createHash("sha256").update(content).digest("hex"),
        size: content.length,
        mtime: Math.floor(st.mtimeMs / 1000),
      });
    }
  }
  return files;
}

function computeManifestHash(files: EvidenceFileEntry[]): string {
  const material = files
    .map((f) => `${f.path}|${f.sha256}|${f.size}`)
    .join("\n");
  return createHash("sha256").update(material, "utf-8").digest("hex");
}

/** Port of wf_evidence_capture_step. */
export async function captureStepEvidence(opts: {
  step: number;
  repoRoot: string;
  evidenceDir: string;
  dispatchBase: string;
}): Promise<string> {
  const files = await collectDispatchFiles(
    opts.repoRoot,
    opts.dispatchBase,
    opts.step,
  );
  const manifestHash = computeManifestHash(files);
  const payload: EvidenceManifest = {
    step: opts.step,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    file_count: files.length,
    manifest_hash: manifestHash,
    signature: `sha256:${manifestHash}`,
    files,
  };
  const manifestPath = manifestPathFor(opts.evidenceDir, opts.step);
  await mkdir(opts.evidenceDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(payload, null, 2), "utf-8");
  return manifestPath;
}

export type EvidenceVerifyResult =
  | { ok: true; fileCount: number }
  | { ok: false; errors: string[] };

/** Port of wf_evidence_verify_step. */
export async function verifyStepEvidence(opts: {
  step: number;
  repoRoot: string;
  manifestPath: string;
  dispatchBase: string;
}): Promise<EvidenceVerifyResult> {
  if (!(await pathExists(opts.manifestPath))) {
    return { ok: false, errors: ["manifest_missing"] };
  }

  const manifest = JSON.parse(
    await readFile(opts.manifestPath, "utf-8"),
  ) as EvidenceManifest;
  const files = manifest.files ?? [];
  const errors: string[] = [];
  const rebuild: string[] = [];
  const observedPaths = new Set<string>();

  for (const entry of files) {
    const rel = entry.path ?? "";
    const fp = join(opts.repoRoot, rel);
    if (!(await pathExists(fp))) {
      errors.push(`missing:${rel}`);
      continue;
    }
    observedPaths.add(rel);
    const content = await readFile(fp);
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== entry.sha256) {
      errors.push(`checksum_mismatch:${rel}`);
    }
    rebuild.push(`${rel}|${actual}|${content.length}`);
  }

  const manifestHash = createHash("sha256")
    .update(rebuild.join("\n"), "utf-8")
    .digest("hex");
  if (manifestHash !== manifest.manifest_hash) {
    errors.push("manifest_hash_mismatch");
  }

  const live = await collectDispatchFiles(
    opts.repoRoot,
    opts.dispatchBase,
    opts.step,
  );
  for (const f of live) {
    observedPaths.add(f.path);
  }
  const expectedPaths = new Set(files.map((f) => f.path));
  const unexpected = [...observedPaths].filter((p) => !expectedPaths.has(p)).sort();
  if (unexpected.length > 0) {
    errors.push(`unexpected_files:${unexpected.join(",")}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, fileCount: files.length };
}
