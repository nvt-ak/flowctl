#!/usr/bin/env bash
# ============================================================
# IT Product Team Workflow — CLI Manager
# Quản lý flowctl state, approvals, và transitions
#
# Usage:
#   flowctl <command> [args]
#   flowctl <command> [args]
#
# Commands:
#   init --project "Name" [--no-setup]   Khởi tạo + mặc định chạy scripts/setup.sh (Graphify/MCP)
#   status                   Xem trạng thái hiện tại
#   start                    Bắt đầu step hiện tại
#   approve [--by "Name"]    Approve step hiện tại → advance
#   gate-check               Kiểm tra QA gate cho step hiện tại
#   reject "reason"          Reject step với lý do
#   conditional "items"      Approve có điều kiện
#   blocker add "desc"       Thêm blocker
#   blocker resolve <id>     Resolve blocker
#   blocker reconcile        Auto-resolve blockers khi điều kiện đã thỏa
#   decision "desc"          Ghi nhận quyết định
#   dispatch [--launch|--headless] [--trust] [--dry-run] [--force-run] [--max-retries N] [--role name] [--budget-override-reason text]
#                            Tạo briefs; launch UI hoặc chạy headless nền
#   collect                  Gom worker reports vào flowctl-state
#   team <start|delegate|sync|status|monitor|recover|budget-reset|run>
#                            PM-only orchestration: step-based spawn/collect/summary
#   brainstorm [topic]       One-shot: init (if needed) + step-based delegate
#   summary                  In summary của step hiện tại
#   audit-tokens             Audit token overhead/work từ MCP events
#   release-dashboard        PM release summary cho approve decision
#   reset <step>             Reset về step cụ thể (cần confirm)
#   history                  Lịch sử approvals
#   mcp --shell-proxy|--workflow-state
#                            Chạy MCP servers qua flowctl wrapper
# ============================================================

set -euo pipefail

WORKFLOW_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$PWD}"
WORKFLOW_CLI_CMD="${WORKFLOW_CLI_CMD:-flowctl}"

# Windows (Git Bash / MSYS2): convert MSYS paths (/c/Users/...) to mixed format
# (C:/Users/...) so Python's open() can resolve them correctly.
if command -v cygpath &>/dev/null 2>&1; then
  WORKFLOW_ROOT="$(cygpath -m "$WORKFLOW_ROOT")"
  PROJECT_ROOT="$(cygpath -m "$PROJECT_ROOT")"
fi

# ── Library modules ───────────────────────────────────────────
LIB_DIR="$WORKFLOW_ROOT/scripts/workflow/lib"
# shellcheck source=/dev/null
source "$LIB_DIR/config.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/common.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/state.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/evidence.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/traceability.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/lock.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/gate.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/budget.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/dispatch.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/complexity.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/war_room.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/mercenary.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/retro.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/cursor_dispatch.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/orchestration.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/reporting.sh"
# shellcheck source=/dev/null
source "$LIB_DIR/flow_cli.sh"

# shellcheck source=/dev/null
source "$LIB_DIR/bootstrap_init_flow.sh"

# ── Export home dir env vars for subprocesses (node, python, bash) ──
export FLOWCTL_HOME FLOWCTL_DATA_DIR FLOWCTL_CACHE_DIR FLOWCTL_RUNTIME_DIR \
       FLOWCTL_EVENTS_F FLOWCTL_STATS_F

# ── Windows Unicode fix: force Python subprocesses to use UTF-8 I/O ──
# Without this, Python on Windows defaults to cp1252 and crashes on ✓ → ✗ ○
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

# ── Commands ─────────────────────────────────────────────────

# Copy files from $1 into $2, skipping files that already exist (unless overwrite=true).
# Uses find+cp for portability on Windows Git Bash (no rsync needed).
_scaffold_dir() {
  local src="$1" dst="$2" overwrite="${3:-false}"
  [[ -d "$src" ]] || return 0
  mkdir -p "$dst"
  if [[ "$overwrite" == "true" ]]; then
    cp -r "$src/." "$dst/"
    return 0
  fi
  # Merge: only copy files not present in dst
  while IFS= read -r -d '' f; do
    local rel="${f#$src/}"
    local target="$dst/$rel"
    if [[ ! -e "$target" ]]; then
      mkdir -p "$(dirname "$target")"
      cp "$f" "$target"
    fi
  done < <(find "$src" -type f -print0)
}

ensure_project_scaffold() {
  local overwrite_existing="${1:-false}"
  local had_settings="false"
  local mcp_status="skipped"
  local settings_status="skipped"

  mkdir -p "$PROJECT_ROOT/.cursor" "$PROJECT_ROOT/.claude"

  [[ -f "$PROJECT_ROOT/.claude/settings.json" ]] && had_settings="true"

  local merge_py="$WORKFLOW_ROOT/scripts/merge_cursor_mcp.py"
  if [[ ! -f "$merge_py" ]]; then
    wf_error "Không tìm thấy merge MCP: $merge_py"
    exit 1
  fi
  # --global: also merge into ~/.cursor/mcp.json so servers are auto-activated
  # globally — no manual enable needed in Cursor Settings → MCP per project.
  local py_out="" merge_rc=0
  if [[ "$overwrite_existing" == "true" ]]; then
    py_out="$(python3 "$merge_py" --overwrite --scaffold "$WORKFLOW_CLI_CMD" "$PROJECT_ROOT/.cursor/mcp.json" 2>&1)" || merge_rc=$?
  else
    py_out="$(python3 "$merge_py" --scaffold "$WORKFLOW_CLI_CMD" "$PROJECT_ROOT/.cursor/mcp.json" 2>&1)" || merge_rc=$?
  fi
  if [[ "$merge_rc" -eq 2 ]]; then
    wf_warn ".cursor/mcp.json: JSON không hợp lệ hoặc mcpServers sai kiểu — sửa tay hoặc chạy ${WORKFLOW_CLI_CMD} init --overwrite"
    mcp_status="invalid_json"
  elif [[ "$merge_rc" -ne 0 ]]; then
    if [[ "$py_out" == *"PermissionError"* && "$py_out" == *".cursor/mcp.json"* ]]; then
      wf_warn ".cursor/mcp.json: không có quyền ghi trong môi trường hiện tại — bỏ qua merge MCP cho lần chạy này"
      mcp_status="skipped_permission_denied"
    else
      wf_error "merge_cursor_mcp.py thất bại (exit $merge_rc)"
      exit 1
    fi
  else
    case "$py_out" in
      *MCP_STATUS=created*)     mcp_status="created" ;;
      *MCP_STATUS=overwritten*) mcp_status="overwritten" ;;
      *MCP_STATUS=merged*)      mcp_status="merged" ;;
      *MCP_STATUS=unchanged*)   mcp_status="unchanged" ;;
      *) mcp_status="updated" ;;
    esac
    # Show global MCP merge result (auto-activation status)
    if [[ "$py_out" == *"GLOBAL_MCP_STATUS=created"* ]]; then
      wf_success "~/.cursor/mcp.json: created (MCP servers auto-activated globally)"
    elif [[ "$py_out" == *"GLOBAL_MCP_STATUS=merged"* ]]; then
      wf_success "~/.cursor/mcp.json: merged (MCP servers already active globally)"
    elif [[ "$py_out" == *"GLOBAL_MCP_STATUS=unchanged"* ]]; then
      wf_info "~/.cursor/mcp.json: unchanged"
    elif [[ "$py_out" == *"GLOBAL_MCP_STATUS=skipped"* ]]; then
      wf_warn "~/.cursor/mcp.json: skipped — activate MCP servers manually in Cursor Settings → MCP"
    fi
  fi

  if [[ -f "$WORKFLOW_ROOT/.claude/settings.json" ]]; then
    if [[ ! -f "$PROJECT_ROOT/.claude/settings.json" || "$overwrite_existing" == "true" ]]; then
      cp "$WORKFLOW_ROOT/.claude/settings.json" "$PROJECT_ROOT/.claude/settings.json"
      if [[ "$had_settings" == "true" ]]; then
        settings_status="overwritten"
      else
        settings_status="created"
      fi
    fi
  fi

  # Note: workflows/runtime/ was moved to ~/.flowctl/projects/*/runtime/ in v1.1.
  # gates/reports is now per-flow (workflows/<flow_short>/gates/reports/) — created on demand by gate-check.
  # Only the shared policy dir needs to exist at init time.
  mkdir -p "$PROJECT_ROOT/workflows/gates"
  mkdir -p "$PROJECT_ROOT/workflows/policies"
  local gate_template="$WORKFLOW_ROOT/templates/qa-gate.v1.json"
  if [[ -f "$gate_template" && ! -f "$PROJECT_ROOT/workflows/gates/qa-gate.v1.json" ]]; then
    mkdir -p "$PROJECT_ROOT/workflows/gates"
    cp "$gate_template" "$PROJECT_ROOT/workflows/gates/qa-gate.v1.json"
  fi

  mkdir -p "$PROJECT_ROOT/workflows/policies"
  local budget_template="$WORKFLOW_ROOT/templates/budget-policy.v1.json"
  if [[ -f "$budget_template" && ! -f "$PROJECT_ROOT/workflows/policies/budget-policy.v1.json" ]]; then
    cp "$budget_template" "$PROJECT_ROOT/workflows/policies/budget-policy.v1.json"
  fi
  local role_template="$WORKFLOW_ROOT/templates/role-policy.v1.json"
  if [[ -f "$role_template" && ! -f "$PROJECT_ROOT/workflows/policies/role-policy.v1.json" ]]; then
    cp "$role_template" "$PROJECT_ROOT/workflows/policies/role-policy.v1.json"
  fi

  # .cursor subdirs: agents, commands, rules, skills, templates
  local cursor_dirs=("agents" "commands" "rules" "skills" "templates")
  local cursor_statuses=()
  for _dir in "${cursor_dirs[@]}"; do
    local _src="$WORKFLOW_ROOT/.cursor/$_dir"
    local _dst="$PROJECT_ROOT/.cursor/$_dir"
    if [[ -d "$_src" ]]; then
      local _existed="false"
      [[ -d "$_dst" ]] && _existed="true"
      _scaffold_dir "$_src" "$_dst" "$overwrite_existing"
      if [[ "$_existed" == "false" ]]; then
        cursor_statuses+=("$_dir:created")
      elif [[ "$overwrite_existing" == "true" ]]; then
        cursor_statuses+=("$_dir:overwritten")
      else
        cursor_statuses+=("$_dir:merged")
      fi
    fi
  done

  # .cursorrules
  local cursorrules_status="skipped"
  local _cr_src="$WORKFLOW_ROOT/.cursorrules"
  local _cr_dst="$PROJECT_ROOT/.cursorrules"
  if [[ -f "$_cr_src" ]]; then
    if [[ ! -f "$_cr_dst" || "$overwrite_existing" == "true" ]]; then
      cp "$_cr_src" "$_cr_dst"
      cursorrules_status="$([[ -f "$_cr_dst" && "$overwrite_existing" == "true" ]] && echo "overwritten" || echo "created")"
    else
      cursorrules_status="unchanged"
    fi
  fi

  # .cursor/hooks.json — Cursor lifecycle hooks (beforeShellExecution → flowctl hook cursor-shell-event)
  local hooks_status="skipped"
  local _hooks_src="$WORKFLOW_ROOT/.cursor/hooks.json"
  local _hooks_dst="$PROJECT_ROOT/.cursor/hooks.json"
  if [[ -f "$_hooks_src" ]]; then
    if [[ ! -f "$_hooks_dst" || "$overwrite_existing" == "true" ]]; then
      cp "$_hooks_src" "$_hooks_dst"
      hooks_status="$([[ -f "$_hooks_dst" && "$overwrite_existing" == "true" ]] && echo "overwritten" || echo "created")"
    else
      hooks_status="unchanged"
    fi
  fi

  # .cursorignore — exclude volatile/generated files from Cursor AI + indexing
  local cursorignore_status="skipped"
  local _ci_src="$WORKFLOW_ROOT/templates/cursorignore"
  local _ci_dst="$PROJECT_ROOT/.cursorignore"
  if [[ -f "$_ci_src" ]]; then
    if [[ ! -f "$_ci_dst" ]]; then
      cp "$_ci_src" "$_ci_dst"
      cursorignore_status="created"
    elif [[ "$overwrite_existing" == "true" ]]; then
      cp "$_ci_src" "$_ci_dst"
      cursorignore_status="overwritten"
    else
      # Append any missing entries (idempotent merge)
      while IFS= read -r line; do
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
        grep -qxF "$line" "$_ci_dst" || echo "$line" >> "$_ci_dst"
      done < "$_ci_src"
      cursorignore_status="merged"
    fi
  fi

  # .cursorindexingignore — exclude from indexing only (AI can still read)
  local cursorindexingignore_status="skipped"
  local _cii_src="$WORKFLOW_ROOT/templates/cursorindexingignore"
  local _cii_dst="$PROJECT_ROOT/.cursorindexingignore"
  if [[ -f "$_cii_src" ]]; then
    if [[ ! -f "$_cii_dst" ]]; then
      cp "$_cii_src" "$_cii_dst"
      cursorindexingignore_status="created"
    elif [[ "$overwrite_existing" == "true" ]]; then
      cp "$_cii_src" "$_cii_dst"
      cursorindexingignore_status="overwritten"
    else
      while IFS= read -r line; do
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
        grep -qxF "$line" "$_cii_dst" || echo "$line" >> "$_cii_dst"
      done < "$_cii_src"
      cursorindexingignore_status="merged"
    fi
  fi

  wf_info "Scaffold status:"
  [[ -n "${STATE_FILE:-}" ]] && wf_info "Workflow state: $STATE_FILE"
  [[ "$mcp_status" == "created" || "$mcp_status" == "overwritten" || "$mcp_status" == "merged" || "$mcp_status" == "unchanged" || "$mcp_status" == "skipped_permission_denied" ]] && \
    wf_success ".cursor/mcp.json: $mcp_status" || wf_warn ".cursor/mcp.json: $mcp_status"
  [[ "$hooks_status" == "created" || "$hooks_status" == "overwritten" || "$hooks_status" == "unchanged" ]] && \
    wf_success ".cursor/hooks.json: $hooks_status" || wf_warn ".cursor/hooks.json: $hooks_status"
  for _s in "${cursor_statuses[@]}"; do
    wf_success ".cursor/${_s/:*}: ${_s/*:}"
  done
  [[ "$cursorrules_status" == "created" || "$cursorrules_status" == "overwritten" || "$cursorrules_status" == "unchanged" ]] && \
    wf_success ".cursorrules: $cursorrules_status" || wf_warn ".cursorrules: $cursorrules_status"
  [[ "$cursorignore_status" != "skipped" ]] && \
    wf_success ".cursorignore: $cursorignore_status" || true
  [[ "$cursorindexingignore_status" != "skipped" ]] && \
    wf_success ".cursorindexingignore: $cursorindexingignore_status" || true
  [[ "$settings_status" == "created" || "$settings_status" == "overwritten" ]] && \
    wf_success ".claude/settings.json: $settings_status" || wf_warn ".claude/settings.json: $settings_status"
}

cmd_mcp() {
  local mode="${1:-}"
  local target=""

  case "$mode" in
    --shell-proxy)   target="$WORKFLOW_ROOT/scripts/workflow/mcp/shell-proxy.js" ;;
    --workflow-state) target="$WORKFLOW_ROOT/scripts/workflow/mcp/workflow-state.js" ;;
    --setup)
      # Print setup instructions for .cursor/mcp.json
      echo -e "\n${BOLD}${CYAN}flowctl MCP Setup${NC}\n"
      echo -e "Thêm vào ${BOLD}.cursor/mcp.json${NC} của project:\n"
      cat <<SETUP
{
  "mcpServers": {
    "shell-proxy": {
      "command": "flowctl",
      "args": ["mcp", "--shell-proxy"],
      "env": {
        "FLOWCTL_PROJECT_ROOT": "\${workspaceFolder}",
        "FLOWCTL_HOME": "$(echo "$FLOWCTL_HOME")"
      }
    },
    "flowctl-state": {
      "command": "flowctl",
      "args": ["mcp", "--workflow-state"],
      "env": {
        "FLOWCTL_PROJECT_ROOT": "\${workspaceFolder}",
        "FLOWCTL_HOME": "$(echo "$FLOWCTL_HOME")"
      }
    }
  }
}
SETUP
      echo -e "\n${YELLOW}Lưu ý:${NC} Xóa ${BOLD}shell-proxy${NC} và ${BOLD}flowctl-state${NC} khỏi global ${BOLD}~/.cursor/mcp.json${NC}"
      echo -e "         (giữ lại gitnexus nếu có — nó không phụ thuộc project root)\n"
      return 0
      ;;
    *)
      wf_error "MCP mode không hợp lệ: ${mode:-<empty>}"
      wf_info "Usage: ${WORKFLOW_CLI_CMD} mcp --shell-proxy | --workflow-state | --setup"
      exit 1
      ;;
  esac

  if [[ ! -f "$target" ]]; then
    wf_error "Không tìm thấy MCP script: $target"
    exit 1
  fi

  exec node "$target"
}

cmd_audit_tokens() {
  local audit_script="$WORKFLOW_ROOT/scripts/token-audit.py"
  if [[ ! -f "$audit_script" ]]; then
    wf_error "Không tìm thấy token audit script: $audit_script"
    exit 1
  fi
  python3 "$audit_script" "$@"
}

cmd_init() {
  local project_name=""
  local overwrite_existing="false"
  local run_setup="true"
  [[ "${FLOWCTL_SKIP_SETUP:-}" == "1" ]] && run_setup="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project) project_name="$2"; shift 2 ;;
      --overwrite|--force) overwrite_existing="true"; shift ;;
      --no-setup) run_setup="false"; shift ;;
      *) shift ;;
    esac
  done

  [[ -z "$project_name" ]] && project_name="$(basename "$PROJECT_ROOT")"

  local is_new_project="false"
  [[ -z "${STATE_FILE:-}" || ! -f "$STATE_FILE" ]] && is_new_project="true"
  [[ "$overwrite_existing" == "true" ]] && is_new_project="true"

  local _preserved_flow_id=""
  if [[ -n "${STATE_FILE:-}" && -f "$STATE_FILE" ]]; then
    _preserved_flow_id=$(WF_STATE_FILE="$STATE_FILE" python3 - <<'PY'
import json, os, sys
from pathlib import Path
try:
    raw = Path(os.environ["WF_STATE_FILE"]).read_text(encoding="utf-8")
    d = json.loads(raw) if raw.strip() else {}
    print(d.get("flow_id", ""))
except Exception:
    print("")
PY
    ) || true
  fi

  _bootstrap_init_flow "$project_name" "$overwrite_existing"
  flowctl_refresh_runtime_paths
  wf_acquire_flow_lock
  ensure_project_scaffold "$overwrite_existing"

  # Pass all shell variables via env — never interpolate user input into python3 -c strings
  # (shell injection: project_name with ' or ` would close the string and execute code).
  WF_STATE_FILE="$STATE_FILE" \
  WF_PROJECT_NAME="$project_name" \
  WF_PRESERVED_ID="$_preserved_flow_id" \
  python3 - <<'PY'
import json, uuid, os, sys
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

state_file   = Path(os.environ["WF_STATE_FILE"])
project_name = os.environ["WF_PROJECT_NAME"]
preserved    = os.environ["WF_PRESERVED_ID"].strip()

raw = state_file.read_text(encoding="utf-8")
data = json.loads(raw) if raw.strip() else {}

data['project_name']       = project_name
data['created_at']         = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
data['updated_at']         = data['created_at']
data['current_step']       = 1
data['overall_status']     = 'in_progress'
data.setdefault('steps', {}).setdefault('1', {})['status'] = 'pending'

# Priority order for flow_id:
#   1. _preserved_flow_id captured before scaffold (handles --overwrite wipe)
#   2. Existing flow_id already in state (handles plain re-init)
#   3. Generate a fresh UUID (new project)
if preserved:
    data['flow_id'] = preserved
elif not data.get('flow_id'):
    data['flow_id'] = 'wf-' + str(uuid.uuid4())

state_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
PY

  # ── Create ~/.flowctl home dir structure ─────────────────────
  # Recompute data dir now that flow_id is written (config.sh ran before init,
  # so FLOWCTL_DATA_DIR may have been set to the fallback path).
  local _new_fl_id _new_fl_name _new_short _new_slug
  _new_fl_id=$(python3 -c "import json; print(json.load(open('$STATE_FILE', encoding='utf-8')).get('flow_id',''))" 2>/dev/null || echo "")
  _new_fl_name="$project_name"

  if [[ -n "$_new_fl_id" ]]; then
    _new_short="${_new_fl_id:3:8}"
    _new_slug=$(printf '%s' "$_new_fl_name" \
      | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' \
      | sed 's/^[-]*//;s/[-]*$//' | cut -c1-32)
    [[ -z "$_new_slug" ]] && _new_slug="project"

    # Reuse existing data dir — check by PROJECT_ROOT path first, then by flow_id.
    # Path-first dedup handles the common case where flowctl-state.json was deleted
    # or reset (new UUID generated) but the project dir on disk is the same — without
    # this, every re-init after a state wipe creates a new orphan folder.
    local _existing_data_dir=""
    if [[ -d "$FLOWCTL_HOME/projects" ]]; then
      for _entry in "$FLOWCTL_HOME/projects"/*/; do
        local _meta="${_entry}meta.json"
        [[ -f "$_meta" ]] || continue
        # 1. Match by repo path (handles UUID change after state reset)
        if grep -qF "\"$PROJECT_ROOT\"" "$_meta" 2>/dev/null; then
          _existing_data_dir="${_entry%/}"
          break
        fi
        # 2. Match by flow_id (handles project rename — same UUID, different path)
        if grep -qF "\"$_new_fl_id\"" "$_meta" 2>/dev/null; then
          _existing_data_dir="${_entry%/}"
          break
        fi
      done
    fi

    if [[ -n "$_existing_data_dir" ]]; then
      FLOWCTL_DATA_DIR="$_existing_data_dir"
    else
      # Prefer clean slug ("md2pdf") over slug+id ("md2pdf-f9f9938a").
      # Only fall back to slug+id when the slug dir already exists for a DIFFERENT
      # project (same name, different repo path) — prevents silent clobber.
      local _clean_dir="$FLOWCTL_HOME/projects/${_new_slug}"
      local _clean_meta="$_clean_dir/meta.json"
      if [[ ! -d "$_clean_dir" ]]; then
        # Slug dir is free — use it
        FLOWCTL_DATA_DIR="$_clean_dir"
      elif [[ ! -f "$_clean_meta" ]] || grep -qF "\"$PROJECT_ROOT\"" "$_clean_meta" 2>/dev/null; then
        # Slug dir exists and belongs to this project (or has no meta) — reuse
        FLOWCTL_DATA_DIR="$_clean_dir"
      else
        # Slug taken by a different project — disambiguate with short ID
        FLOWCTL_DATA_DIR="$FLOWCTL_HOME/projects/${_new_slug}-${_new_short}"
      fi
    fi
    FLOWCTL_CACHE_DIR="$FLOWCTL_DATA_DIR/cache"
    FLOWCTL_RUNTIME_DIR="$FLOWCTL_DATA_DIR/runtime"
    FLOWCTL_EVENTS_F="$FLOWCTL_CACHE_DIR/events.jsonl"
    FLOWCTL_STATS_F="$FLOWCTL_CACHE_DIR/session-stats.json"
    export FLOWCTL_DATA_DIR FLOWCTL_CACHE_DIR FLOWCTL_RUNTIME_DIR \
           FLOWCTL_EVENTS_F FLOWCTL_STATS_F

    # Create directory structure
    mkdir -p \
      "$FLOWCTL_CACHE_DIR" \
      "$FLOWCTL_RUNTIME_DIR/evidence" \
      "$FLOWCTL_RUNTIME_DIR/release-dashboard" \
      "$FLOWCTL_HOME/projects"

    # Write / update meta.json.
    # When reusing an existing dir (path-based dedup), preserve original created_at
    # and update project_id if UUID changed (state reset scenario).
    WF_DATA_DIR="$FLOWCTL_DATA_DIR" WF_FL_ID="$_new_fl_id" \
    WF_FL_NAME="$_new_fl_name" WF_ROOT="$PROJECT_ROOT" \
    WF_CACHE="$FLOWCTL_CACHE_DIR" WF_RUNTIME="$FLOWCTL_RUNTIME_DIR" \
    python3 - <<'PY'
import json, os
from datetime import datetime
from pathlib import Path

data_dir  = os.environ["WF_DATA_DIR"]
fl_id     = os.environ["WF_FL_ID"]
fl_name   = os.environ["WF_FL_NAME"]
root      = os.environ["WF_ROOT"]
cache     = os.environ["WF_CACHE"]
runtime   = os.environ["WF_RUNTIME"]
meta_path = Path(data_dir) / "meta.json"

now = datetime.now().isoformat()
# Preserve created_at if meta already exists (reuse scenario)
created_at = now
if meta_path.exists():
    try:
        existing = json.loads(meta_path.read_text(encoding="utf-8"))
        created_at = existing.get("created_at", now)
    except Exception:
        pass

meta = {
    "project_id":   fl_id,
    "project_name": fl_name,
    "path":         root,
    "cache_dir":    cache,
    "runtime_dir":  runtime,
    "created_at":   created_at,
    "last_seen":    now,
}
meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
PY
  fi

  # Create ~/.flowctl/config.json if it doesn't exist yet
  if [[ ! -f "$FLOWCTL_HOME/config.json" ]]; then
    mkdir -p "$FLOWCTL_HOME"
    cat > "$FLOWCTL_HOME/config.json" <<'JSON'
{
  "version": 1,
  "monitor": {
    "default_port": 3170,
    "auto_open_browser": true
  },
  "defaults": {
    "budget_per_step": 12000,
    "prune_after_days": 30
  },
  "theme": "dark"
}
JSON
  fi

  if [[ "$run_setup" == "true" && "$is_new_project" == "true" ]]; then
    local setup_script="$WORKFLOW_ROOT/scripts/setup.sh"
    if [[ ! -f "$setup_script" ]]; then
      wf_warn "Không tìm thấy setup: $setup_script (bỏ qua)"
    else
      wf_info "Chạy setup (Graphify, MCP, .gitignore)..."
      if FLOWCTL_PROJECT_ROOT="$PROJECT_ROOT" bash "$setup_script"; then
        wf_success "Setup hoàn tất."
      else
        wf_warn "setup.sh thoát không thành công — chạy lại: FLOWCTL_PROJECT_ROOT=\"$PROJECT_ROOT\" bash \"$setup_script\""
      fi
    fi
  elif [[ "$run_setup" == "true" && "$is_new_project" == "false" ]]; then
    wf_info "Project đã tồn tại — bỏ qua setup (dùng --overwrite để chạy lại setup)."
  fi

  echo ""
  wf_success "Project \"$project_name\" đã được khởi tạo."
  wf_info "Step hiện tại: 1 — Requirements Analysis"
  wf_info "Agent cần dùng: @pm (hỗ trợ: @tech-lead)"
  wf_info "Bước tiếp theo: ${WORKFLOW_CLI_CMD} start"
  wf_warn "Ghi đè scaffold chỉ khi thật sự cần: ${WORKFLOW_CLI_CMD} init --overwrite --project \"$project_name\""
  [[ "$run_setup" == "false" ]] && wf_info "Đã bỏ qua setup (dùng --no-setup hoặc FLOWCTL_SKIP_SETUP=1)."
  echo ""
}

cmd_status_all() {
  local registry="$HOME/.flowctl/registry.json"
  if [[ ! -f "$registry" ]]; then
    wf_warn "Registry chưa có (~/.flowctl/registry.json)."
    wf_info "Mở project và chạy một lệnh flowctl để tự đăng ký."
    exit 0
  fi

  echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${BOLD}   All Projects — flowctl registry${NC}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  python3 - "$registry" <<'PY'
import json, sys
from datetime import datetime, timezone

# Windows cp1252 fix
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

reg      = json.loads(open(sys.argv[1]).read())
projects = sorted(reg.get("projects", {}).values(),
                  key=lambda p: p.get("last_seen",""), reverse=True)
now      = datetime.now(timezone.utc)

if not projects:
    print("  (no projects registered)"); sys.exit(0)

for p in projects:
    try:
        last    = datetime.fromisoformat(p["last_seen"].replace("Z","+00:00"))
        age_sec = int((now - last).total_seconds())
    except Exception:
        age_sec = 999999
    age_str = (f"{age_sec}s" if age_sec < 60 else
               f"{age_sec//60}m" if age_sec < 3600 else
               f"{age_sec//3600}h") + " ago"
    dot     = ("\033[0;32m●\033[0m" if age_sec < 600 else
               "\033[1;33m○\033[0m" if age_sec < 3600 else
               "\033[0;90m·\033[0m")
    blk     = p.get("open_blockers", 0)
    b_str   = f"  \033[0;31m⚠ {blk} blocker(s)\033[0m" if blk else ""
    print(f"  {dot} \033[1m{p.get('project_name','?'):<28}\033[0m"
          f"Step {p.get('current_step',0)}/9  "
          f"{p.get('overall_status','?'):<14}{age_str}{b_str}")
    print(f"    \033[0;90m{p.get('path','?')}\033[0m\n")
PY
}

cmd_status() {
  [[ "${1:-}" == "--all" ]] && { cmd_status_all; return; }

  [[ ! -f "$STATE_FILE" ]] && {
    wf_error "Không tìm thấy workflow state (STATE_FILE không resolve được hoặc file không tồn tại)."
    wf_info "Hành động đề xuất: chạy ${WORKFLOW_CLI_CMD} init --project \"Tên dự án\" hoặc export FLOWCTL_STATE_FILE=..."
    exit 1
  }

  local step overall project
  step=$(wf_json_get "current_step")
  overall=$(wf_json_get "overall_status")
  project=$(wf_json_get "project_name")

  echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${BOLD}   Workflow Status${NC}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  [[ -n "$project" ]] && echo -e "  Project: ${BOLD}$project${NC}"
  echo -e "  Status:  ${YELLOW}$overall${NC}"
  echo ""

  # In tất cả steps
  python3 -c "
import json, sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('$STATE_FILE', encoding='utf-8') as f:
    data = json.load(f)

current = data.get('current_step', 0)
steps = data.get('steps', {})

icons = {
    'completed':   '\033[0;32m✓\033[0m',
    'in_progress': '\033[1;33m→\033[0m',
    'approved':    '\033[0;32m✓\033[0m',
    'pending':     '\033[0;90m○\033[0m',
    'rejected':    '\033[0;31m✗\033[0m',
    'skipped':     '\033[0;90m⊘\033[0m',
}

# Virtual numbering: count only non-skipped steps
active_total = sum(1 for s in steps.values() if s.get('status') != 'skipped')
active_idx = 0

for n in range(1, 10):
    s = steps.get(str(n), {})
    name   = s.get('name', '')
    status = s.get('status', 'pending')
    agent  = s.get('agent', '')
    icon   = icons.get(status, '○')

    if status == 'skipped':
        reason = s.get('skip_reason', '')
        reason_str = f' — {reason}' if reason else ''
        print(f'  \033[0;90m⊘ [SKIP] {name}{reason_str}\033[0m')
        continue

    active_idx += 1
    prefix = '\033[1m→ \033[0m' if n == current else '  '

    approval = ''
    if s.get('approval_status'):
        approval = f\" [{s['approval_status'].upper()}]\"

    print(f'{prefix}{icon} Step {active_idx}/{active_total}: {name} (@{agent}){approval}')
"

  echo ""

  # Blockers
  python3 -c "
import json
with open('$STATE_FILE', encoding='utf-8') as f:
    data = json.load(f)
step = str(data.get('current_step', 1))
blockers = data.get('steps', {}).get(step, {}).get('blockers', [])
open_blockers = [b for b in blockers if not b.get('resolved')]
if open_blockers:
    print(f'\033[0;31m  Blockers ({len(open_blockers)}):\033[0m')
    for i, b in enumerate(open_blockers):
        print(f'    [{i}] {b.get(\"description\", \"\")}')
    print()
"

  echo -e "  Dùng ${CYAN}${WORKFLOW_CLI_CMD} approve${NC} sau khi step hoàn thành\n"
}

cmd_start() {
  local step
  step=$(wf_require_initialized_workflow)

  # Auto-advance past any skipped steps
  local cur_status
  cur_status=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$step',{}).get('status','pending'))")
  while [[ "$cur_status" == "skipped" ]]; do
    local skip_reason
    skip_reason=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$step',{}).get('skip_reason',''))")
    local step_name
    step_name=$(wf_get_step_name "$step")
    echo -e "  ${YELLOW}⊘ Step $step — $step_name: SKIPPED ($skip_reason)${NC}"
    step=$((step + 1))
    if [[ $step -gt 9 ]]; then
      wf_json_set "overall_status" "completed"
      echo -e "\n${GREEN}${BOLD}🎉 WORKFLOW HOÀN THÀNH — tất cả steps đã complete/skipped.${NC}\n"
      return 0
    fi
    wf_json_set "current_step" "$step" "number"
    cur_status=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$step',{}).get('status','pending'))")
  done

  wf_json_set "steps.$step.status" "in_progress"
  wf_json_set "steps.$step.started_at" "$(wf_now)"

  local name agent
  name=$(wf_get_step_name "$step")
  agent=$(wf_get_step_agent "$step")

  # Count active (non-skipped) steps for display
  local active_count active_index
  active_count=$(python3 -c "
import json; d=json.load(open('$STATE_FILE', encoding='utf-8'))
print(sum(1 for s in d['steps'].values() if s.get('status') != 'skipped'))
")
  active_index=$(python3 -c "
import json; d=json.load(open('$STATE_FILE', encoding='utf-8'))
steps = d.get('steps', {})
idx = 0
for n in range(1, 10):
    s = steps.get(str(n), {})
    if s.get('status') != 'skipped':
        idx += 1
    if n == $step:
        print(idx); break
")

  bash "$WORKFLOW_ROOT/scripts/hooks/invalidate-cache.sh" state 2>/dev/null || true
  echo -e "\n${GREEN}${BOLD}Step $step ($active_index/$active_count active) — $name đã bắt đầu${NC}"
  echo -e "Agent chính: ${YELLOW}@$agent${NC}"
  echo -e "\nLoad workflow context:"
  echo -e "  ${CYAN}wf_step_context()${NC}          ← decisions + blockers (1 call)"
  if [[ "$step" -ge 4 ]]; then
    echo -e "  ${CYAN}cat graphify-out/GRAPH_REPORT.md${NC} ← code structure overview"
  fi
  echo -e "\nXem agent guide: ${BOLD}.cursor/agents/${agent}-agent.md${NC}\n"
  wf_mcp_health_check
}

cmd_approve() {
  local by="Human"
  local skip_gate="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --by)
        if [[ $# -lt 2 ]]; then
      wf_error "Thiếu giá trị cho --by."
      wf_info "Hành động đề xuất: dùng --by \"Tên người duyệt\""
          exit 1
        fi
        by="$2"
        shift 2
        ;;
      --skip-gate) skip_gate="true"; shift ;;
      *) shift ;;
    esac
  done
  local step
  step=$(wf_require_initialized_workflow)
  if [[ "$skip_gate" != "true" ]]; then
    local gate_result
    if ! gate_result=$(wf_evaluate_gate "$step"); then
      wf_write_gate_report "$step" "FAIL" "${gate_result#GATE_FAIL|}" "$by"
      echo ""
      wf_error "APPROVE bị chặn bởi QA Gate."
      wf_error "${gate_result#GATE_FAIL|}"
      wf_info "Hành động đề xuất: chạy ${WORKFLOW_CLI_CMD} gate-check"
      wf_warn "Bypass có chủ đích (có audit trail): ${WORKFLOW_CLI_CMD} approve --skip-gate --by \"Name\""
      echo ""
      exit 1
    fi
    wf_write_gate_report "$step" "PASS" "${gate_result#GATE_OK|}" "$by"
    wf_success "QA Gate passed: ${gate_result#GATE_OK|}"
  else
    wf_write_gate_report "$step" "BYPASS" "approve --skip-gate was used" "$by"
  fi
  local name
  name=$(wf_get_step_name "$step")

  wf_json_set "steps.$step.status" "completed"
  wf_json_set "steps.$step.approval_status" "approved"
  wf_json_set "steps.$step.completed_at" "$(wf_now)"
  wf_json_set "steps.$step.approved_at" "$(wf_now)"
  wf_json_set "steps.$step.approved_by" "$by"

  # Advance to next step — skip over any skipped steps
  local next_step=$((step + 1))
  while [[ $next_step -le 9 ]]; do
    local next_status
    next_status=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$next_step',{}).get('status','pending'))")
    if [[ "$next_status" != "skipped" ]]; then
      break
    fi
    local skipped_name skipped_reason
    skipped_name=$(wf_get_step_name "$next_step")
    skipped_reason=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$next_step',{}).get('skip_reason',''))")
    echo -e "  ${YELLOW}⊘ Step $next_step — $skipped_name: SKIPPED ($skipped_reason)${NC}"
    next_step=$((next_step + 1))
  done

  echo -e "\n${GREEN}${BOLD}✓ Step $step — $name: APPROVED${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if [[ $next_step -le 9 ]]; then
    wf_json_set "current_step" "$next_step" "number"
    local next_name next_agent
    next_name=$(wf_get_step_name "$next_step")
    next_agent=$(wf_get_step_agent "$next_step")
    echo -e "\n${CYAN}${BOLD}→ Tiếp theo: Step $next_step — $next_name${NC}"
    echo -e "Agent: ${YELLOW}@$next_agent${NC}"
    echo -e "Bắt đầu: ${BOLD}${WORKFLOW_CLI_CMD} start${NC}\n"
  else
    wf_json_set "overall_status" "completed"
    echo -e "\n${GREEN}${BOLD}🎉 WORKFLOW HOÀN THÀNH! Project đã release.${NC}\n"
  fi
  # Invalidate MCP state cache + generate token report
  bash "$WORKFLOW_ROOT/scripts/hooks/invalidate-cache.sh" state 2>/dev/null || true
  python3 "$WORKFLOW_ROOT/scripts/hooks/generate-token-report.py" --step "$step" 2>/dev/null || true

  local manifest_rel="workflows/runtime/evidence/step-${step}-manifest.json"
  local trace_row
  trace_row=$(wf_traceability_record_approval "$step" "$by" "$([[ "$skip_gate" == "true" ]] && echo "bypass" || echo "approved")" "$manifest_rel" 2>/dev/null || true)
  if [[ -n "$trace_row" ]]; then
    local trace_event_id trace_payload trace_result
    trace_event_id=$(TRACE_ROW="$trace_row" python3 - <<'PY'
import json, os
row=json.loads(os.environ["TRACE_ROW"])
print(row.get("event_id",""))
PY
)
    trace_payload=$(TRACE_ROW="$trace_row" python3 - <<'PY'
import json, os
row=json.loads(os.environ["TRACE_ROW"])
print(json.dumps(row.get("payload", {}), ensure_ascii=False))
PY
)
    trace_result=$(wf_traceability_append_event "$trace_event_id" "approval" "$trace_payload" 2>/dev/null || true)
    [[ -n "$trace_result" ]] && echo -e "${CYAN}${trace_result}${NC}"
  fi

  # Auto-run retro on the just-approved step so lessons are captured immediately.
  # Pass step explicitly — current_step has already been advanced to next_step,
  # so cmd_retro's default "prev_step" logic would pick the wrong step when
  # skipped steps are in between.
  cmd_retro "$step" 2>/dev/null || true
}

cmd_gate_check() {
  local step
  step=$(wf_require_initialized_workflow)
  local result
  if result=$(wf_evaluate_gate "$step"); then
    wf_write_gate_report "$step" "PASS" "${result#GATE_OK|}" "gate-check"
    echo -e "${GREEN}${BOLD}QA Gate: PASS${NC}"
    echo -e "${result#GATE_OK|}\n"
  else
    wf_write_gate_report "$step" "FAIL" "${result#GATE_FAIL|}" "gate-check"
    echo -e "${RED}${BOLD}QA Gate: FAIL${NC}"
    echo -e "${RED}${result#GATE_FAIL|}${NC}\n"
    exit 1
  fi
}

# ── Skip presets ─────────────────────────────────────────────
# bash 3.x compat: use functions instead of associative arrays

_skip_preset_steps() {
  # Returns space-separated step numbers for a preset name
  case "$1" in
    hotfix)        echo "2 3 5 6" ;;
    api-only)      echo "3 5" ;;
    backend-api)   echo "3 5" ;;
    frontend-only) echo "2 4 6 8" ;;
    design-sprint) echo "4 5 6 7 8 9" ;;
    research)      echo "3 4 5 6 7 8 9" ;;
    devops-only)   echo "1 2 3 4 5 6 7" ;;
    qa-only)       echo "1 2 3 4 5 6 8" ;;
    *)             echo "" ;;
  esac
}

_skip_reason_label() {
  # Returns human-readable label for a reason type
  case "$1" in
    no-ui)          echo "Không có UI changes" ;;
    no-backend)     echo "Không có backend changes" ;;
    hotfix)         echo "Hotfix — bỏ qua ceremony" ;;
    api-only)       echo "API-only — không cần Frontend/UI" ;;
    backend-api)    echo "API-only — không cần Frontend/UI" ;;
    no-deploy)      echo "Không cần deploy riêng" ;;
    research)       echo "Research spike — chỉ cần phân tích" ;;
    no-integration) echo "Không có cross-service changes" ;;
    design-sprint)  echo "Design sprint — chỉ cần design" ;;
    devops-only)    echo "DevOps-only task" ;;
    frontend-only)  echo "Frontend-only — không cần backend" ;;
    qa-only)        echo "QA-only task" ;;
    *)              echo "Không có lý do" ;;
  esac
}

cmd_skip() {
  local steps_arg="" preset="" reason_type="custom" reason="" by="PM"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --steps|-s)   steps_arg="$2"; shift 2 ;;
      --step)       steps_arg="$2"; shift 2 ;;
      --preset|-p)  preset="$2"; shift 2 ;;
      --type|-t)    reason_type="$2"; shift 2 ;;
      --reason|-r)  reason="$2"; shift 2 ;;
      --by)         by="$2"; shift 2 ;;
      *)            shift ;;
    esac
  done

  wf_require_initialized_workflow > /dev/null

  # Resolve preset → steps list
  local steps_list=""
  if [[ -n "$preset" ]]; then
    steps_list="$(_skip_preset_steps "$preset")"
    if [[ -z "$steps_list" ]]; then
      wf_error "Preset không hợp lệ: $preset"
      wf_info "Preset hợp lệ: hotfix, api-only, backend-api, frontend-only, design-sprint, research, devops-only, qa-only"
      exit 1
    fi
    [[ -z "$reason" ]] && reason="Preset: $preset"
    [[ "$reason_type" == "custom" ]] && reason_type="$preset"
  elif [[ -n "$steps_arg" ]]; then
    # Normalize "3,5,6" or "3 5 6" → space-separated
    steps_list="${steps_arg//,/ }"
  else
    wf_error "Cần chỉ định --steps hoặc --preset."
    wf_info "Ví dụ: ${WORKFLOW_CLI_CMD} skip --steps 3,5 --reason \"API-only\""
    wf_info "       ${WORKFLOW_CLI_CMD} skip --preset hotfix"
    exit 1
  fi

  local _label
  _label="$(_skip_reason_label "$reason_type")"
  [[ -z "$reason" ]] && reason="$_label"

  local skipped_names=()
  local current_step
  current_step=$(wf_json_get "current_step")

  for s in $steps_list; do
    # Validate range
    if ! [[ "$s" =~ ^[1-9]$ ]]; then
      wf_warn "Bỏ qua step không hợp lệ: $s (hợp lệ: 1-9)"
      continue
    fi
    # Cannot skip current or already-completed step
    local cur_status
    cur_status=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$s',{}).get('status','pending'))")
    if [[ "$cur_status" == "completed" || "$cur_status" == "approved" ]]; then
      wf_warn "Step $s đã hoàn thành — không thể skip."
      continue
    fi
    if [[ "$s" == "$current_step" && "$cur_status" == "in_progress" ]]; then
      wf_warn "Step $s đang in_progress — không thể skip. Hoàn thành hoặc reject trước."
      continue
    fi

    local step_name
    step_name=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$s',{}).get('name','Step $s'))")

    wf_json_set "steps.$s.status"        "skipped"
    wf_json_set "steps.$s.skip_reason"   "$reason"
    wf_json_set "steps.$s.skip_type"     "$reason_type"
    wf_json_set "steps.$s.skipped_by"    "$by"
    wf_json_set "steps.$s.skipped_at"    "$(wf_now)"

    skipped_names+=("Step $s: $step_name")
  done

  # If current_step is now skipped, auto-advance to next active step
  current_step=$(wf_json_get "current_step")
  local cur_status
  cur_status=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$current_step',{}).get('status','pending'))")
  if [[ "$cur_status" == "skipped" ]]; then
    local next
    next=$(python3 -c "
import json
d = json.load(open('$STATE_FILE', encoding='utf-8'))
cur = int(d.get('current_step', 1))
for n in range(cur + 1, 10):
    if d['steps'].get(str(n), {}).get('status', 'pending') != 'skipped':
        print(n); break
else:
    print(cur)
")
    wf_json_set "current_step" "$next" "number"
  fi

  bash "$WORKFLOW_ROOT/scripts/hooks/invalidate-cache.sh" state 2>/dev/null || true

  echo -e "\n${YELLOW}${BOLD}⊘ Steps đã được skip:${NC}"
  for name in "${skipped_names[@]}"; do
    echo -e "  ${YELLOW}░ $name${NC}"
  done
  echo -e "  Lý do: ${reason} (type: ${reason_type})"
  echo -e "  Skipped by: ${by}\n"
  echo -e "Reverse: ${BOLD}${WORKFLOW_CLI_CMD} unskip --step N${NC}\n"
}

cmd_unskip() {
  local step_arg="" reason=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --step|-s) step_arg="$2"; shift 2 ;;
      --reason|-r) reason="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  [[ -z "$step_arg" ]] && { wf_error "Cần chỉ định --step N."; exit 1; }
  wf_require_initialized_workflow > /dev/null

  local cur_status
  cur_status=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$step_arg',{}).get('status','pending'))")
  if [[ "$cur_status" != "skipped" ]]; then
    wf_error "Step $step_arg không ở trạng thái skipped (hiện: $cur_status)."
    exit 1
  fi

  local step_name
  step_name=$(python3 -c "import json; d=json.load(open('$STATE_FILE', encoding='utf-8')); print(d['steps'].get('$step_arg',{}).get('name','Step $step_arg'))")

  wf_json_set "steps.$step_arg.status"      "pending"
  wf_json_set "steps.$step_arg.skip_reason" ""
  wf_json_set "steps.$step_arg.skip_type"   ""
  wf_json_set "steps.$step_arg.skipped_by"  ""
  wf_json_set "steps.$step_arg.skipped_at"  ""

  # If unskipped step is earlier than current_step, pull current_step back
  local current_step
  current_step=$(wf_json_get "current_step")
  if [[ "$step_arg" -lt "$current_step" ]]; then
    wf_json_set "current_step" "$step_arg" "number"
    wf_warn "current_step đã được đặt lại về step $step_arg."
  fi

  bash "$WORKFLOW_ROOT/scripts/hooks/invalidate-cache.sh" state 2>/dev/null || true

  echo -e "\n${GREEN}✓ Step $step_arg — $step_name: UNSKIPPED (pending)${NC}"
  [[ -n "$reason" ]] && echo -e "  Lý do unskip: $reason"
  echo ""
}

cmd_assess() {
  wf_require_initialized_workflow > /dev/null
  local step
  step=$(wf_json_get "current_step")
  local project
  project=$(wf_json_get "project_name")

  echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${BOLD}   Workflow Assessment — $project${NC}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

  echo -e "${CYAN}PM: Đánh giá từng step dưới đây và quyết định skip nếu không cần thiết.${NC}\n"

  python3 -c "
import json
d = json.load(open('$STATE_FILE', encoding='utf-8'))
steps = d.get('steps', {})
current = d.get('current_step', 1)

criteria = {
  '3': ('UI/UX Design',      'Skip nếu: API-only, bug fix không có UI, backend refactor'),
  '5': ('Frontend Dev',      'Skip nếu: không có UI changes, API-only service'),
  '6': ('Integration Test',  'Skip nếu: chỉ sửa 1 isolated service, không cross-service'),
  '8': ('DevOps & Deploy',   'Skip nếu: infrastructure đã sẵn, chỉ hotfix nhỏ'),
  '2': ('System Design',     'Skip nếu: hotfix rõ ràng, không thay đổi architecture'),
  '7': ('QA Testing',        'Hiếm khi skip — chỉ bỏ nếu hotfix production cực khẩn'),
}

print('  Step  Status    Tên                    Gợi ý skip')
print('  ' + '─'*70)
for n in range(1, 10):
    s = steps.get(str(n), {})
    status = s.get('status', 'pending')
    name = s.get('name', '')
    hint = criteria.get(str(n), ('', ''))[1] if str(n) in criteria else ''
    marker = '→' if n == current else ' '
    status_display = {
        'pending': '\033[0;90mpending \033[0m',
        'skipped': '\033[0;33mskipped \033[0m',
        'in_progress': '\033[1;33min_prog  \033[0m',
        'completed': '\033[0;32mcompleted\033[0m',
    }.get(status, status)
    print(f'  {marker} {n}    {status_display}  {name:<22} {hint}')
"

  echo -e "\n${CYAN}Presets có sẵn:${NC}"
  echo -e "  --preset hotfix       → skip steps 2,3,5,6"
  echo -e "  --preset api-only     → skip steps 3,5"
  echo -e "  --preset design-sprint → skip steps 4,5,6,7,8,9"
  echo -e "  --preset research     → skip steps 3,4,5,6,7,8,9"
  echo -e "  --preset devops-only  → skip steps 1,2,3,4,5,6,7"
  echo -e "\n${CYAN}Lệnh skip:${NC}"
  echo -e "  ${WORKFLOW_CLI_CMD} skip --preset hotfix"
  echo -e "  ${WORKFLOW_CLI_CMD} skip --steps 3,5 --type api-only --reason \"REST API endpoint only\""
  echo ""
}

cmd_reject() {
  local reason="${1:-Không có lý do}"
  local step
  step=$(wf_require_initialized_workflow)
  local name
  name=$(wf_get_step_name "$step")

  wf_json_set "steps.$step.approval_status" "rejected"
  wf_json_set "steps.$step.status" "in_progress"

  # Append rejection note
  wf_json_append "steps.$step.decisions" "{\"type\": \"rejection\", \"reason\": \"$reason\", \"date\": \"$(wf_today)\"}"

  echo -e "\n${RED}${BOLD}✗ Step $step — $name: REJECTED${NC}"
  echo -e "Lý do: $reason"
  echo -e "\nAddress concerns rồi chạy lại: ${BOLD}${WORKFLOW_CLI_CMD} approve${NC}\n"
}

cmd_add_blocker() {
  local desc="${1:-}"
  [[ -z "$desc" ]] && { wf_info "Nhập mô tả blocker:"; read -r desc; }

  local step
  step=$(wf_require_initialized_workflow)
  local id="B$(date +%Y%m%d%H%M%S)"

  wf_json_append "steps.$step.blockers" "{\"id\": \"$id\", \"description\": \"$desc\", \"created_at\": \"$(wf_now)\", \"resolved\": false}"

  # Update metrics
  python3 -c "
import json
with open('$STATE_FILE', encoding='utf-8') as f: d = json.load(f)
d['metrics']['total_blockers'] = d['metrics'].get('total_blockers', 0) + 1
with open('$STATE_FILE', 'w', encoding='utf-8') as f: json.dump(d, f, indent=2, ensure_ascii=False)
"

  echo -e "\n${YELLOW}Blocker đã được ghi nhận: [$id] $desc${NC}"
  echo -e "Resolve: ${BOLD}${WORKFLOW_CLI_CMD} blocker resolve $id${NC}\n"
}

cmd_resolve_blocker() {
  local id="${1:-}"
  [[ -z "$id" ]] && { wf_error "Thiếu blocker id."; wf_info "Usage: blocker resolve <id>"; exit 1; }

  local step
  step=$(wf_require_initialized_workflow)

  python3 -c "
import json
from datetime import datetime

with open('$STATE_FILE', encoding='utf-8') as f:
    data = json.load(f)

step = str(data.get('current_step', 1))
blockers = data.get('steps', {}).get(step, {}).get('blockers', [])
for b in blockers:
    if b.get('id') == '$id':
        b['resolved'] = True
        b['resolved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

with open('$STATE_FILE', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Blocker $id đã được resolved')
"
}

cmd_reconcile_blockers() {
  local step
  step=$(wf_require_initialized_workflow)

  WF_STATE_FILE="$STATE_FILE" WF_REPO_ROOT="$REPO_ROOT" WF_ROLE_POLICY_FILE="$ROLE_POLICY_FILE" WF_STEP="$step" python3 - <<'PY'
import json
import os
import re
from datetime import datetime
from pathlib import Path

state_path = Path(os.environ["WF_STATE_FILE"])
repo_root = Path(os.environ["WF_REPO_ROOT"])
role_policy_path = Path(os.environ["WF_ROLE_POLICY_FILE"])
step = str(os.environ["WF_STEP"])
now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

data = json.loads(state_path.read_text(encoding="utf-8"))
blockers = data.get("steps", {}).get(step, {}).get("blockers", []) or []

roles_cfg = {}
if role_policy_path.exists():
    try:
        roles_cfg = (json.loads(role_policy_path.read_text(encoding="utf-8")) or {}).get("roles", {}) or {}
    except Exception:
        roles_cfg = {}

resolved = []
remaining = []

def all_backtick_paths_exist(desc: str) -> bool:
    paths = re.findall(r"`([^`]+)`", desc or "")
    if not paths:
        return False
    return all((repo_root / p).exists() for p in paths)

def resolve_rule_matched(desc: str) -> tuple[bool, str]:
    text = (desc or "").lower()

    # Specific rule for role-policy blocker: require backend + frontend roles.
    if "role-policy.v1.json" in text:
      if "backend" in roles_cfg and "frontend" in roles_cfg:
          return True, "role-policy covers backend/frontend"
      return False, "role-policy missing backend/frontend"

    # Specific rule for docs traceability blocker.
    if "docs/requirements.md" in text and "docs/architecture.md" in text:
      req_ok = (repo_root / "docs/requirements.md").exists()
      arch_ok = (repo_root / "docs/architecture.md").exists()
      if req_ok and arch_ok:
          return True, "requirements + architecture docs exist"
      missing = []
      if not req_ok:
          missing.append("docs/requirements.md")
      if not arch_ok:
          missing.append("docs/architecture.md")
      return False, "missing: " + ", ".join(missing)

    # Generic heuristic: if all quoted file paths now exist.
    if all_backtick_paths_exist(desc):
        return True, "all referenced backtick paths exist"

    return False, "no reconcile rule matched"

for b in blockers:
    if b.get("resolved"):
        continue
    ok, reason = resolve_rule_matched(b.get("description", ""))
    if ok:
        b["resolved"] = True
        b["resolved_at"] = now
        b["resolved_by"] = "reconcile"
        b["resolution_note"] = reason
        resolved.append((b.get("id", "?"), reason))
    else:
        remaining.append((b.get("id", "?"), reason))

data["updated_at"] = now
state_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

print(f"RECONCILE_OK|step={step}|resolved={len(resolved)}|remaining_open={len(remaining)}")
for bid, reason in resolved:
    print(f"RESOLVED|{bid}|{reason}")
for bid, reason in remaining:
    print(f"OPEN|{bid}|{reason}")
PY
}

cmd_add_decision() {
  local desc="${1:-}"
  [[ -z "$desc" ]] && { wf_info "Nhập nội dung quyết định:"; read -r desc; }

  local step
  step=$(wf_require_initialized_workflow)
  local id="D$(date +%Y%m%d%H%M%S)"

  wf_json_append "steps.$step.decisions" "{\"id\": \"$id\", \"description\": \"$desc\", \"date\": \"$(wf_today)\"}"

  python3 -c "
import json
with open('$STATE_FILE', encoding='utf-8') as f: d = json.load(f)
d['metrics']['total_decisions'] = d['metrics'].get('total_decisions', 0) + 1
with open('$STATE_FILE', 'w', encoding='utf-8') as f: json.dump(d, f, indent=2, ensure_ascii=False)
"

  echo -e "${GREEN}Quyết định đã được ghi nhận: [$id]${NC}\n"
}

# ── Main dispatcher ──────────────────────────────────────────
CMD="${1:-status}"
shift || true

# Ensure home dirs exist for any command that writes runtime state
# (skip for init — cmd_init() creates dirs itself after generating flow_id)
case "$CMD" in
  -v|--version|version|init|monitor|mon|mcp|help|-h|--help) ;;
  *)
    flowctl_ensure_data_dirs
    ;;
esac

case "$CMD" in
  start|gate-check|approve|reject|conditional|blocker|decision|dispatch|cursor-dispatch|collect|team|reset|brainstorm|release-dashboard|war-room|mercenary|retro|complexity|audit-tokens|audit|skip|unskip|assess)
    wf_acquire_flow_lock
    ;;
  *)
    ;;
esac

case "$CMD" in
  -v|--version|version)
    VERSION=$(python3 -c "import json; print(json.load(open('$WORKFLOW_ROOT/package.json'))['version'])" 2>/dev/null || echo "unknown")
    echo "flowctl $VERSION"
    exit 0
    ;;
  init)         cmd_init "$@" ;;
  status|s)     cmd_status "$@" ;;
  start)        cmd_start ;;
  gate-check|gate) cmd_gate_check ;;
  approve|a)    cmd_approve "$@" ;;
  reject|r)     cmd_reject "$@" ;;
  conditional)  cmd_reject "$@" ;;
  blocker)
    SUBCMD="${1:-}"; shift || true
    case "$SUBCMD" in
      add)     cmd_add_blocker "$@" ;;
      resolve) cmd_resolve_blocker "$@" ;;
      reconcile) cmd_reconcile_blockers "$@" ;;
      *)       wf_error "Subcommand blocker không hợp lệ."; wf_info "Usage: blocker [add|resolve|reconcile]" ;;
    esac
    ;;
  decision|d)   cmd_add_decision "$@" ;;
  dispatch)        cmd_dispatch "$@" ;;
  cursor-dispatch|cd) cmd_cursor_dispatch "$@" ;;
  collect)         cmd_collect ;;
  war-room|wr)
    SUBCMD="${1:-start}"; shift || true
    case "$SUBCMD" in
      merge)  cmd_war_room_merge ;;
      *)      cmd_war_room ;;
    esac
    ;;
  mercenary|merc)
    SUBCMD="${1:-scan}"; shift || true
    cmd_mercenary "$SUBCMD" "$@"
    ;;
  monitor|mon)
    # Pass project root so monitor-web.py resolves REPO correctly for global installs
    # Auto --global if not inside a project dir and not already specified
    if [[ ! -f "$STATE_FILE" && "${1:-}" != "--once" && "${1:-}" != "--global" ]]; then
      FLOWCTL_PROJECT_ROOT="$PROJECT_ROOT" python3 "$WORKFLOW_ROOT/scripts/monitor-web.py" --global "$@"
    else
      FLOWCTL_PROJECT_ROOT="$PROJECT_ROOT" python3 "$WORKFLOW_ROOT/scripts/monitor-web.py" "$@"
    fi
    ;;
  retro)        cmd_retro "$@" ;;
  skip)         cmd_skip "$@" ;;
  unskip)       cmd_unskip "$@" ;;
  assess)       cmd_assess ;;
  complexity)   cmd_complexity ;;
  mcp)          cmd_mcp "$@" ;;
  hook)
    # Internal hook runner — used by .claude/settings.json so user projects
    # don't need hardcoded paths to the flowctl npm package scripts.
    # Usage: flowctl hook <name> [args...]
    #   flowctl hook log-bash-event     ← PostToolUse bash waste detection
    #   flowctl hook invalidate-cache   ← SessionStart cache invalidation
    #   flowctl hook session-start      ← SessionStart workflow status message
    _hook_name="${1:-}"; shift || true
    case "$_hook_name" in
      log-bash-event|log_bash_event|cursor-shell-event|cursor_shell_event)
        # Both Claude Code PostToolUse and Cursor beforeShellExecution are handled
        # by the same script — format is auto-detected from stdin hook_event_name field.
        python3 "$WORKFLOW_ROOT/scripts/hooks/log-bash-event.py" "$@" 2>/dev/null || true ;;
      invalidate-cache|invalidate_cache)
        bash "$WORKFLOW_ROOT/scripts/hooks/invalidate-cache.sh" "${1:-state}" 2>/dev/null || true ;;
      session-start|session_start)
        # Print workflow status systemMessage for Claude Code SessionStart
        [[ -f "$STATE_FILE" ]] && python3 - <<'PY' 2>/dev/null || true
import json, os
from pathlib import Path
state_f = Path(os.environ.get("_FLOWCTL_SF", "flowctl-state.json"))
if not state_f.exists(): raise SystemExit(0)
d = json.loads(state_f.read_text(encoding="utf-8"))
s = d.get("current_step", 0)
steps = d.get("steps", {})
step = steps.get(str(s), {}) if s else {}
name   = step.get("name", "")
agent  = step.get("agent", "")
status = d.get("overall_status", "not_started")
blockers = len([b for b in step.get("blockers", []) if not b.get("resolved")])
print(json.dumps({"systemMessage":
    f'[Workflow] {d.get("project_name","?")} | {status} | Step {s}: {name} | @{agent} | Blockers: {blockers} | Use wf_state() not cat | Monitor: flowctl monitor'
}))
PY
        ;;
      *)
        wf_error "Unknown hook: ${_hook_name:-<empty>}"
        wf_info "Available: log-bash-event, invalidate-cache, session-start"
        exit 1 ;;
    esac ;;
  team)         cmd_team "$@" ;;
  brainstorm|bs) cmd_brainstorm "$@" ;;
  summary|sum)  cmd_summary ;;
  audit-tokens|audit) cmd_audit_tokens "$@" ;;
  release-dashboard|dashboard) cmd_release_dashboard "$@" ;;
  history|h)    cmd_history ;;
  reset)        cmd_reset "$@" ;;
  flow|flows)   cmd_flow "$@" ;;
  help|--help|-h)
    echo ""
    wf_info "IT Product Workflow CLI"
    echo -e "  -v, --version          Xem version hiện tại"
    echo -e "  init --project \"Name\" [--no-setup]  Khởi tạo dự án (+ setup mặc định)"
    echo -e "  status [--all]         Xem trạng thái (--all: tất cả projects trong registry)"
    echo -e "  start                  Bắt đầu step hiện tại"
    echo -e "  monitor [--once] [--port=N] [--interval=N]"
    echo -e "                         Mở web dashboard tại localhost"
    echo -e "  mcp --shell-proxy|--workflow-state|--setup"
    echo -e "                         Chạy MCP servers qua flowctl wrapper"
    echo -e "  complexity             Đánh giá complexity score + hints graphify/git (read-only)"
    echo -e "  war-room [merge]       Phase 0: PM + TechLead align (ngưỡng WF_WAR_ROOM_THRESHOLD, mặc định 4)"
    echo -e "  cursor-dispatch [cd] [--skip-war-room] [--merge] [--high-risk] [--impacted-modules N] [--force-war-room]"
    echo -e "                         Phase A: Tạo briefs + Spawn Board (auto War Room nếu cần)"
    echo -e "  collect                Phase A collect: gom reports + detect NEEDS_SPECIALIST"
    echo -e "  mercenary [scan|spawn] Phase B: Scan/spawn mercenary specialists"
    echo -e "  retro [step]           Post-approve: extract lessons → .graphify/lessons.json"
    echo -e "  gate-check             Kiểm tra QA gate cho step hiện tại"
    echo -e "  assess                 PM workflow assessment — xem steps + gợi ý skip"
    echo -e "  skip --steps N[,M] [--preset name] [--type T] [--reason \"...\"]"
    echo -e "                         Skip steps không cần thiết cho task này"
    echo -e "  unskip --step N [--reason \"...\"]"
    echo -e "                         Reverse một skip decision"
    echo -e "  approve [--by Name] [--skip-gate]"
    echo -e "                         Approve và advance (default có QA gate)"
    echo -e "  reject \"reason\"        Reject với lý do"
    echo -e "  blocker add \"desc\"     Thêm blocker"
    echo -e "  blocker resolve <id>   Resolve blocker"
    echo -e "  blocker reconcile      Auto-resolve blockers khi điều kiện đã đủ"
    echo -e "  decision \"desc\"        Ghi nhận quyết định"
    echo -e "  dispatch [--dry-run|--headless] [--role name]"
    echo -e "                         Tạo worker briefs (low-level, dùng cursor-dispatch thay)"
    echo -e "  team <start|delegate|sync|status|monitor|recover|budget-reset|run>"
    echo -e "                         PM-only orchestration cho sub-agents"
    echo -e "  brainstorm [topic]     One-shot auto init + delegate theo current step"
    echo -e "  summary                Tóm tắt step hiện tại"
    echo -e "  audit-tokens [--days N] [--format table|markdown|json] [--limit N] [--skill-sizes]"
    echo -e "                         Audit token overhead/work; --skill-sizes = compact vs manifest lazy lines"
    echo -e "  release-dashboard      PM release summary"
    echo -e "  history                Lịch sử approvals"
    echo -e "  reset <step>           Reset về step cụ thể"
    echo -e "  flow list|new|switch  Đa luồng state (.flowctl/flows.json + FLOWCTL_STATE_FILE)"
    echo ""
    wf_info "Mẹo: bắt đầu nhanh với ${WORKFLOW_CLI_CMD} init --project \"Tên dự án\""
    wf_info "Mẹo: xem trạng thái bất kỳ lúc nào với ${WORKFLOW_CLI_CMD} status"
    echo ""
    ;;
  *)
    wf_error "Lệnh không hợp lệ: $CMD"
    wf_info "Hành động đề xuất: dùng --help để xem danh sách lệnh."
    exit 1
    ;;
esac
