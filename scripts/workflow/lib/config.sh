#!/usr/bin/env bash

# Centralized runtime/config paths for flowctl engine.
# WORKFLOW_ROOT: nơi chứa flowctl engine/scripts (global package hoặc local repo).
# PROJECT_ROOT: project đang được điều phối flowctl (mặc định current working dir).
: "${WORKFLOW_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
: "${PROJECT_ROOT:=$PWD}"

REPO_ROOT="$PROJECT_ROOT"
# LIB_DIR = this file's directory (scripts/workflow/lib) — set early for resolve_state_path.py
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Windows: $HOME is a MSYS path (/c/Users/...) — convert to mixed format for Python compat.
_home_native="$HOME"
command -v cygpath &>/dev/null 2>&1 && _home_native="$(cygpath -m "$HOME")"
FLOWCTL_HOME="${FLOWCTL_HOME:-$_home_native/.flowctl}"

# Resolve workflow state JSON path (multi-flow: FLOWCTL_STATE_FILE, FLOWCTL_ACTIVE_FLOW, .flowctl/flows.json)
_STATE_RESOLVE_PY="$LIB_DIR/resolve_state_path.py"
_rs_json="$(
  REPO_ROOT="$REPO_ROOT" \
  FLOWCTL_STATE_FILE="${FLOWCTL_STATE_FILE:-}" \
  FLOWCTL_ACTIVE_FLOW="${FLOWCTL_ACTIVE_FLOW:-}" \
  FLOWCTL_HOME="${FLOWCTL_HOME:-}" \
  python3 "$_STATE_RESOLVE_PY" 2>/dev/null || true
)"
_rs_source=""
if [[ -n "$_rs_json" ]] && echo "$_rs_json" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  STATE_FILE="$(echo "$_rs_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state_file') or '')")"
  _rs_source="$(echo "$_rs_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('source') or '')")"
else
  STATE_FILE=""
  _rs_source="parse_error"
fi

# One-time legacy migration (bash layer only — resolver stays read-only).
if [[ "$_rs_source" == "not_initialized" ]]; then
  if [[ -f "$REPO_ROOT/flowctl-state.json" && ! -L "$REPO_ROOT/flowctl-state.json" ]]; then
    _migrated_sf="$(REPO_ROOT="$REPO_ROOT" python3 "$LIB_DIR/migrate_legacy_state.py" 2>/dev/null)"
    if [[ -n "$_migrated_sf" && -f "$_migrated_sf" ]]; then
      STATE_FILE="$_migrated_sf"
      _rs_source="migrated_legacy"
      # Avoid ${YELLOW}/${NC} here — config.sh may be sourced without wf_* color exports (e.g. tests, set -u).
      printf '%s\n' "[flowctl] Auto-migrated flowctl-state.json → $STATE_FILE" >&2
    fi
  fi
fi

unset _rs_json _STATE_RESOLVE_PY
export STATE_FILE
export FLOWCTL_RESOLVE_SOURCE="${_rs_source:-}"

# ── flowctl Home Directory (~/.flowctl) ───────────────────────
# All volatile/generated runtime data lives outside the repo so
# developers don't need .gitignore magic and data persists across clones.
#
# Layout:
#   ~/.flowctl/
#     config.json                     ← global settings
#     registry.json                   ← project registry
#     projects/
#       <slug>-<short-id>/            ← per-project data dir
#         meta.json                   ← project metadata
#         cache/                      ← shell-proxy cache (replaces .cache/mcp/)
#           events.jsonl
#           session-stats.json
#           wf_state.json, _baselines.json, _gen.json
#         runtime/                    ← workflow runtime (replaces workflows/runtime/)
#           idempotency.json
#           role-sessions.json
#           heartbeats.jsonl
#           budget-state.json
#           budget-events.jsonl
#           traceability-map.jsonl
#           evidence/
#           release-dashboard/
#
# Default workflow state: under .flowctl/flows/<short>/state.json + flows.json (gitignored, local).
# Legacy root flowctl-state.json is migrated once into .flowctl/flows/…
# Override with FLOWCTL_STATE_FILE, FLOWCTL_ACTIVE_FLOW, or .flowctl/flows.json — see docs/workflow-reference.md.
# workflows/policies/ stays in the repo (version-controlled config).
# ─────────────────────────────────────────────────────────────

# Derive data dir slug: lowercase alphanum+dash, max 32 chars, no leading/trailing dash.
_flowctl_make_slug() {
  local name="$1"
  printf '%s' "$name" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -cs 'a-z0-9' '-' \
    | sed 's/^[-]*//;s/[-]*$//' \
    | cut -c1-32
}

# Recompute lock + FLOWCTL_DATA_DIR + dispatch paths after STATE_FILE changes (e.g. init bootstrap).
flowctl_refresh_runtime_paths() {
  export STATE_FILE
  export _FLOWCTL_SF="$STATE_FILE"
  _lock_hash="$(python3 -c "import hashlib,os; p=os.environ.get('_FLOWCTL_SF',''); print(hashlib.sha256(p.encode('utf-8')).hexdigest()[:16])")"
  unset _FLOWCTL_SF
  WORKFLOW_LOCK_DIR="$REPO_ROOT/.flowctl/locks/$_lock_hash"
  export WORKFLOW_LOCK_DIR
  mkdir -p "$REPO_ROOT/.flowctl/locks" 2>/dev/null || true

  _fl_id=""
  _fl_name=""
  _fl_short=""
  if [[ -n "$STATE_FILE" && -f "$STATE_FILE" ]]; then
    _fl_parsed=$(WF_SF="$STATE_FILE" python3 - <<'PY' 2>/dev/null
import json, os
from pathlib import Path
try:
    raw = Path(os.environ["WF_SF"]).read_text(encoding="utf-8")
    d = json.loads(raw) if raw.strip() else {}
    print(d.get("flow_id", "") + "|" + d.get("project_name", ""))
except Exception:
    print("|")
PY
    ) || true
    _fl_id="${_fl_parsed%%|*}"
    _fl_name="${_fl_parsed#*|}"
  fi

  if [[ -n "$_fl_id" ]]; then
    _fl_short="${_fl_id:3:8}"
    _fl_slug="$(_flowctl_make_slug "${_fl_name:-project}")"
    [[ -z "$_fl_slug" ]] && _fl_slug="project"
    : "${FLOWCTL_DATA_DIR:=$FLOWCTL_HOME/projects/${_fl_slug}-${_fl_short}}"
  else
    : "${FLOWCTL_DATA_DIR:=$REPO_ROOT/.cache/flowctl}"
  fi

  : "${FLOWCTL_CACHE_DIR:=$FLOWCTL_DATA_DIR/cache}"
  : "${FLOWCTL_RUNTIME_DIR:=$FLOWCTL_DATA_DIR/runtime}"
  : "${FLOWCTL_EVENTS_F:=$FLOWCTL_CACHE_DIR/events.jsonl}"
  : "${FLOWCTL_STATS_F:=$FLOWCTL_CACHE_DIR/session-stats.json}"

  IDEMPOTENCY_FILE="$FLOWCTL_RUNTIME_DIR/idempotency.json"
  ROLE_SESSIONS_FILE="$FLOWCTL_RUNTIME_DIR/role-sessions.json"
  HEARTBEATS_FILE="$FLOWCTL_RUNTIME_DIR/heartbeats.jsonl"
  BUDGET_STATE_FILE="$FLOWCTL_RUNTIME_DIR/budget-state.json"
  BUDGET_EVENTS_FILE="$FLOWCTL_RUNTIME_DIR/budget-events.jsonl"
  EVIDENCE_DIR="$FLOWCTL_RUNTIME_DIR/evidence"
  TRACEABILITY_FILE="$FLOWCTL_RUNTIME_DIR/traceability-map.jsonl"
  RELEASE_DASHBOARD_DIR="$FLOWCTL_RUNTIME_DIR/release-dashboard"

  ROLE_POLICY_FILE="$REPO_ROOT/workflows/policies/role-policy.v1.json"
  BUDGET_POLICY_FILE="$REPO_ROOT/workflows/policies/budget-policy.v1.json"

  if [[ -n "$_fl_short" ]]; then
    DISPATCH_BASE="$REPO_ROOT/workflows/$_fl_short/dispatch"
    GATE_REPORTS_DIR="$REPO_ROOT/workflows/$_fl_short/gates/reports"
    RETRO_DIR="$REPO_ROOT/workflows/$_fl_short/retro"
  else
    DISPATCH_BASE="$REPO_ROOT/workflows/dispatch"
    GATE_REPORTS_DIR="$REPO_ROOT/workflows/gates/reports"
    RETRO_DIR="$REPO_ROOT/workflows/retro"
  fi

  QA_GATE_FILE="$REPO_ROOT/workflows/gates/qa-gate.v1.json"

  export FLOWCTL_DATA_DIR FLOWCTL_CACHE_DIR FLOWCTL_RUNTIME_DIR FLOWCTL_EVENTS_F FLOWCTL_STATS_F
  export IDEMPOTENCY_FILE ROLE_SESSIONS_FILE HEARTBEATS_FILE BUDGET_STATE_FILE BUDGET_EVENTS_FILE
  export EVIDENCE_DIR TRACEABILITY_FILE RELEASE_DASHBOARD_DIR
  export DISPATCH_BASE GATE_REPORTS_DIR RETRO_DIR ROLE_POLICY_FILE BUDGET_POLICY_FILE QA_GATE_FILE
}

flowctl_refresh_runtime_paths

# Ensure data dirs exist (idempotent, no-op if already created)
flowctl_ensure_data_dirs() {
  # Validate FLOWCTL_HOME is writable before attempting to create sub-dirs.
  # Silently degraded writes (e.g. root-owned ~/.flowctl) are worse than a clear error.
  if [[ -e "$FLOWCTL_HOME" && ! -w "$FLOWCTL_HOME" ]]; then
    echo -e "${RED}[flowctl] ERROR: FLOWCTL_HOME ($FLOWCTL_HOME) exists but is not writable.${NC}" >&2
    echo -e "${YELLOW}[flowctl] Fix: sudo chown \$USER \"$FLOWCTL_HOME\" or set FLOWCTL_HOME to a writable path.${NC}" >&2
    return 1
  fi
  mkdir -p \
    "$FLOWCTL_CACHE_DIR" \
    "$FLOWCTL_RUNTIME_DIR/evidence" \
    "$FLOWCTL_RUNTIME_DIR/release-dashboard" \
    "$FLOWCTL_HOME/projects" \
    2>/dev/null || {
    echo -e "${RED}[flowctl] ERROR: Failed to create data dirs under $FLOWCTL_HOME. Check permissions.${NC}" >&2
    return 1
  }

  # Auto-register project in meta.json the first time any flowctl command runs
  # in a project dir. Ensures `flowctl monitor` discovers pre-v1.1 projects that
  # were initialized before the home-dir layout was introduced — without forcing
  # users to re-run `flowctl init`.
  if [[ -f "$STATE_FILE" && -n "$_fl_id" && ! -f "$FLOWCTL_DATA_DIR/meta.json" ]]; then
    python3 -c "
import json, datetime
from pathlib import Path
try:
    s = json.loads(Path('$STATE_FILE').read_text())
    m = {
        'project_id':   s.get('flow_id',      '$_fl_id'),
        'project_name': s.get('project_name', '$_fl_name'),
        'path':         '$PROJECT_ROOT',
        'cache_dir':    '$FLOWCTL_CACHE_DIR',
        'runtime_dir':  '$FLOWCTL_RUNTIME_DIR',
        'created_at':   datetime.datetime.now().isoformat(),
        'last_seen':    datetime.datetime.now().isoformat(),
    }
    Path('$FLOWCTL_DATA_DIR/meta.json').write_text(json.dumps(m, indent=2))
except Exception:
    pass  # Never block a command because meta.json couldn't be written
" 2>/dev/null || true
  fi
}

# LIB_DIR already set at top of this file.