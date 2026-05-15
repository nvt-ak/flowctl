#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 - <<'PY'
import json
import sys
from pathlib import Path

package = json.loads(Path("package.json").read_text(encoding="utf-8"))
declared_files = set(package.get("files", []))

required_runtime_files = [
    "bin",
    "scripts/flowctl.sh",
    "scripts/setup.sh",
    "scripts/merge_cursor_mcp.py",
    "scripts/monitor-web.py",
    "scripts/token-audit.py",
    "scripts/hooks",
    "scripts/workflow",
    "templates",
    # Cursor agent/rule/skill dirs — must be packaged so `flowctl init` can scaffold them
    ".cursor/agents",
    ".cursor/commands",
    ".cursor/rules",
    ".cursor/skills",
    ".cursorrules",
    # Workflow dispatch/gate/policy templates
    "workflows/dispatch",
    "workflows/gates",
    "workflows/policies",
]

missing_from_package = [path for path in required_runtime_files if path not in declared_files]
missing_on_disk      = [path for path in required_runtime_files if not Path(path).exists()]

errors = []
if missing_from_package:
    errors.append("Missing from package.json files: " + ", ".join(missing_from_package))
if missing_on_disk:
    errors.append("Missing on disk: " + ", ".join(missing_on_disk))

# Verify bin/flowctl is executable
bin_flowctl = Path("bin/flowctl")
if bin_flowctl.exists() and not bin_flowctl.stat().st_mode & 0o111:
    errors.append("bin/flowctl is not executable")

# P3: split-skill manifest must exist and reference real files on disk
manifest = Path(".cursor/skills/core/manifest.json")
if not manifest.is_file():
    errors.append("Missing .cursor/skills/core/manifest.json")
else:
    try:
        mf = json.loads(manifest.read_text(encoding="utf-8"))
        for entry in mf.get("skills_with_detail", []):
            eid = entry.get("id", "?")
            rel_c = entry.get("compact")
            if not rel_c:
                errors.append(f"manifest entry {eid!r} missing 'compact'")
            else:
                p = Path(rel_c)
                if not p.is_file():
                    errors.append(f"manifest path missing on disk ({eid}): {rel_c}")
            lazy = entry.get("lazy")
            if not lazy or not isinstance(lazy, list) or len(lazy) == 0:
                errors.append(f"manifest entry {eid!r} missing non-empty 'lazy' array")
            else:
                for rel in lazy:
                    if not rel:
                        errors.append(f"manifest entry {eid!r} has empty lazy path")
                        continue
                    lp = Path(rel)
                    if not lp.is_file():
                        errors.append(f"manifest lazy path missing on disk ({eid}): {rel}")
    except json.JSONDecodeError as exc:
        errors.append(f"Invalid manifest JSON: {exc}")

if errors:
    for e in errors:
        print(e, file=sys.stderr)
    sys.exit(1)

print(f"Package files OK ({len(required_runtime_files)} paths verified)")
PY
