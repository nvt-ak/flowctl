#!/usr/bin/env bash

# Shared colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
BOLD='\033[1m'; NC='\033[0m'

wf_now() { date '+%Y-%m-%d %H:%M:%S'; }
wf_today() { date '+%Y-%m-%d'; }
wf_ensure_dir() { mkdir -p "$1"; }

wf_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
wf_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
wf_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
wf_error() { echo -e "${RED}[ERROR]${NC} $*"; }

wf_warn_deprecated() {
  local legacy_name="$1"
  local new_name="$2"

  # Per-process dedup (fast path — avoids file I/O on repeat calls in same shell)
  local key="WF_DEPRECATED_WARNED_${legacy_name//[^a-zA-Z0-9]/_}"
  if [[ "${!key:-0}" == "1" ]]; then
    return 0
  fi
  printf -v "$key" '%s' "1"
  export "$key"

  # Cross-process dedup: warn only once per day per function name.
  # Uses ~/.flowctl/seen-deprecations.txt — format: "YYYY-MM-DD funcname"
  local today
  today=$(date +%Y-%m-%d 2>/dev/null || echo "0000-00-00")
  local seen_file="${FLOWCTL_HOME:-$HOME/.flowctl}/seen-deprecations.txt"
  local marker="${today} ${legacy_name}"
  if [[ -f "$seen_file" ]] && grep -qF "$marker" "$seen_file" 2>/dev/null; then
    return 0
  fi
  # Append marker (create file if missing; prune entries older than 7 days)
  mkdir -p "$(dirname "$seen_file")" 2>/dev/null || true
  echo "$marker" >> "$seen_file" 2>/dev/null || true
  # Prune: keep only lines from last 7 days (best-effort, non-blocking)
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import sys
from pathlib import Path
from datetime import datetime, timedelta
p = Path(sys.argv[1])
if not p.exists(): sys.exit(0)
cutoff = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
lines = [l for l in p.read_text().splitlines() if l >= cutoff]
p.write_text('\n'.join(lines) + '\n')
" "$seen_file" 2>/dev/null || true
  fi

  echo -e "${YELLOW}[deprecation] '${legacy_name}' is kept for compatibility; use '${new_name}' instead.${NC}" >&2
}

# ── MCP health check ──────────────────────────────────────────
# Warn once per day if shell-proxy MCP is not wired up correctly.
# Called at flowctl start and flowctl cursor-dispatch — non-blocking.
wf_mcp_health_check() {
  # Dedup: warn at most once per calendar day (same mechanism as deprecation warnings)
  local today seen_file marker
  today=$(date +%Y-%m-%d 2>/dev/null || echo "0000-00-00")
  seen_file="${FLOWCTL_HOME:-$HOME/.flowctl}/seen-mcp-warnings.txt"
  marker="${today} mcp-health"
  if [[ -f "$seen_file" ]] && grep -qF "$marker" "$seen_file" 2>/dev/null; then
    return 0
  fi

  local issues=()

  # 1. .cursor/mcp.json missing → Cursor won't start any MCP server for this project
  local mcp_json="$REPO_ROOT/.cursor/mcp.json"
  if [[ ! -f "$mcp_json" ]]; then
    issues+=("`.cursor/mcp.json` chưa có — MCP servers chưa được cấu hình cho project này.")
  else
    # 2. mcp.json có shell-proxy nhưng thiếu FLOWCTL_HOME
    if python3 -c "
import json, sys
d = json.load(open('$mcp_json', encoding='utf-8'))
sp = d.get('mcpServers', {}).get('shell-proxy', {})
env = sp.get('env', {})
has_home = 'FLOWCTL_HOME' in env
sys.exit(0 if has_home else 1)
" 2>/dev/null; then
      : # FLOWCTL_HOME present — ok
    else
      issues+=("shell-proxy trong \`.cursor/mcp.json\` thiếu \`FLOWCTL_HOME\` → cache ghi sai đường dẫn, token savings không hoạt động.")
    fi
  fi

  # 3. events.jsonl trống → MCP đã start nhưng chưa được dùng lần nào
  local events_f="$FLOWCTL_EVENTS_F"
  if [[ -z "$events_f" ]]; then
    events_f="${FLOWCTL_CACHE_DIR:-$REPO_ROOT/.cache/mcp}/events.jsonl"
  fi
  if [[ ! -s "$events_f" ]]; then
    issues+=("MCP shell-proxy chưa có tool call nào được ghi nhận (\`events.jsonl\` trống) — workers có thể đang bỏ qua \`wf_state()\`/\`wf_step_context()\` và dùng bash thay thế.")
  fi

  [[ ${#issues[@]} -eq 0 ]] && return 0

  echo -e "\n${YELLOW}${BOLD}⚠  MCP Health Check${NC}"
  for issue in "${issues[@]}"; do
    echo -e "  ${YELLOW}•${NC} $issue"
  done
  echo -e "  ${CYAN}→ Xem hướng dẫn: flowctl mcp --setup${NC}\n"

  # Record so we don't repeat today
  mkdir -p "$(dirname "$seen_file")" 2>/dev/null || true
  echo "$marker" >> "$seen_file" 2>/dev/null || true
}

# Backward-compatible aliases (Phase 5.2)
now() { wf_warn_deprecated "now" "wf_now"; wf_now "$@"; }
today() { wf_warn_deprecated "today" "wf_today"; wf_today "$@"; }
ensure_dir() { wf_warn_deprecated "ensure_dir" "wf_ensure_dir"; wf_ensure_dir "$@"; }
