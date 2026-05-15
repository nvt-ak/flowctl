#!/usr/bin/env bash
# invalidate-cache.sh — Invalidate MCP shell proxy cache
# Usage: bash scripts/hooks/invalidate-cache.sh [all|git|state|files]
#
# Called by:
#   - git post-commit hook  → scope=git
#   - flowctl.sh approve/start/collect → scope=state
#   - SessionStart hook → scope=all (full refresh)

SCOPE="${1:-all}"
GEN_FILE=".cache/mcp/_gen.json"

mkdir -p ".cache/mcp"

if [[ ! -f "$GEN_FILE" ]]; then
  echo '{"git":0,"state":0}' > "$GEN_FILE"
fi

python3 - "$SCOPE" "$GEN_FILE" <<'PY'
import json, sys
from pathlib import Path

scope = sys.argv[1]
gen_file = Path(sys.argv[2])

try:
    gen = json.loads(gen_file.read_text())
except Exception:
    gen = {"git": 0, "state": 0}

if scope in ("all", "git"):
    gen["git"] = gen.get("git", 0) + 1
if scope in ("all", "state"):
    gen["state"] = gen.get("state", 0) + 1

gen_file.write_text(json.dumps(gen))
print(f"cache invalidated: scope={scope} gen={gen}")
PY
