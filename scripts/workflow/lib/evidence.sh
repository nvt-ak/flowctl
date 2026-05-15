#!/usr/bin/env bash

wf_evidence_manifest_path() {
  local step="$1"
  echo "$EVIDENCE_DIR/step-${step}-manifest.json"
}

wf_evidence_capture_step() {
  local step="$1"
  local manifest_path
  manifest_path="$(wf_evidence_manifest_path "$step")"
  wf_ensure_dir "$EVIDENCE_DIR"
  WF_STEP="$step" WF_REPO_ROOT="$REPO_ROOT" WF_MANIFEST_PATH="$manifest_path" WF_DISPATCH_BASE="$DISPATCH_BASE" python3 - <<'PY'
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

step = int(os.environ["WF_STEP"])
repo_root = Path(os.environ["WF_REPO_ROOT"])
manifest_path = Path(os.environ["WF_MANIFEST_PATH"])
dispatch_dir = Path(os.environ["WF_DISPATCH_BASE"]) / f"step-{step}"

files = []
for sub in ("reports", "logs"):
    p = dispatch_dir / sub
    if not p.exists():
        continue
    for fp in sorted(p.glob("*")):
        if not fp.is_file():
            continue
        rel = str(fp.relative_to(repo_root))
        content = fp.read_bytes()
        files.append(
            {
                "path": rel,
                "sha256": hashlib.sha256(content).hexdigest(),
                "size": len(content),
                "mtime": int(fp.stat().st_mtime),
            }
        )

digest_material = "\n".join(f"{f['path']}|{f['sha256']}|{f['size']}" for f in files).encode("utf-8")
manifest_hash = hashlib.sha256(digest_material).hexdigest()

payload = {
    "step": step,
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "file_count": len(files),
    "manifest_hash": manifest_hash,
    "signature": f"sha256:{manifest_hash}",
    "files": files,
}
manifest_path.parent.mkdir(parents=True, exist_ok=True)
manifest_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"EVIDENCE_CAPTURED|manifest={manifest_path}")
PY
}

wf_evidence_verify_step() {
  local step="$1"
  local manifest_path
  manifest_path="$(wf_evidence_manifest_path "$step")"
  WF_STEP="$step" WF_REPO_ROOT="$REPO_ROOT" WF_MANIFEST_PATH="$manifest_path" WF_DISPATCH_BASE="$DISPATCH_BASE" python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

repo_root = Path(os.environ["WF_REPO_ROOT"])
manifest_path = Path(os.environ["WF_MANIFEST_PATH"])
if not manifest_path.exists():
    print("EVIDENCE_FAIL|manifest_missing")
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
files = manifest.get("files", [])
errors = []
rebuild = []
expected_paths = {entry.get("path", "") for entry in files}
observed_paths = set()

for entry in files:
    rel = entry.get("path", "")
    expected = entry.get("sha256", "")
    fp = repo_root / rel
    if not fp.exists():
        errors.append(f"missing:{rel}")
        continue
    observed_paths.add(rel)
    content = fp.read_bytes()
    actual = hashlib.sha256(content).hexdigest()
    if actual != expected:
        errors.append(f"checksum_mismatch:{rel}")
    rebuild.append(f"{rel}|{actual}|{len(content)}")

manifest_hash = hashlib.sha256("\n".join(rebuild).encode("utf-8")).hexdigest()
if manifest_hash != manifest.get("manifest_hash", ""):
    errors.append("manifest_hash_mismatch")

step = manifest.get("step")
dispatch_dir = Path(os.environ["WF_DISPATCH_BASE"]) / f"step-{step}"
for sub in ("reports", "logs"):
    p = dispatch_dir / sub
    if not p.exists():
        continue
    for fp in sorted(p.glob("*")):
        if not fp.is_file():
            continue
        rel = str(fp.relative_to(repo_root))
        observed_paths.add(rel)

unexpected = sorted(observed_paths - expected_paths)
if unexpected:
    errors.append("unexpected_files:" + ",".join(unexpected))

if errors:
    print("EVIDENCE_FAIL|" + ";".join(errors))
    raise SystemExit(1)

print(f"EVIDENCE_OK|files={len(files)}")
PY
}
