#!/usr/bin/env bash
# cursor_dispatch.sh — Cursor-native parallel agent dispatch
# Phase 0: War Room (PM + TechLead align, complexity-gated)
# Phase A: Full team dispatch
# Phase B: Mercenary spawn (triggered by collect if NEEDS_SPECIALIST found)

# Persist PM risk flags + optional impacted_modules onto current step (before scoring).
_wf_cursor_dispatch_persist_flags() {
  local step="$1"
  local high_risk="$2"
  local impacted_raw="$3"
  WF_STATE_FILE="$STATE_FILE" WF_STEP="$step" WF_HIGH_RISK="$high_risk" WF_IMPACTED_RAW="$impacted_raw" python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path(os.environ["WF_STATE_FILE"])
step = str(os.environ["WF_STEP"])
high = os.environ.get("WF_HIGH_RISK", "false").lower() == "true"
raw = (os.environ.get("WF_IMPACTED_RAW") or "").strip()

data = json.loads(path.read_text(encoding="utf-8"))
s = data.setdefault("steps", {}).setdefault(step, {})
dr = s.setdefault("dispatch_risk", {})
if high:
    dr["high_risk"] = True
if raw.isdigit():
    dr["impacted_modules"] = int(raw)
path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
PY
}

# ── Main entry ─────────────────────────────────────────────────

cmd_cursor_dispatch() {
  local skip_war_room="false"
  local merge_only="false"
  local high_risk="false"
  local impacted_modules=""
  local force_war_room="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-war-room)   skip_war_room="true" ;;
      --merge)           merge_only="true" ;;
      --high-risk)       high_risk="true" ;;
      --impacted-modules)
        impacted_modules="${2:-}"
        shift
        ;;
      --force-war-room)  force_war_room="true" ;;
      *)
        echo -e "${RED}[cursor-dispatch]${NC} Unknown option: $1"
        echo -e "Usage: flowctl cursor-dispatch [--skip-war-room] [--merge] [--high-risk] [--impacted-modules N] [--force-war-room]\n"
        exit 1
        ;;
    esac
    shift
  done

  local step
  step=$(wf_require_initialized_workflow)

  wf_mcp_health_check

  local thr="${WF_WAR_ROOM_THRESHOLD:-4}"
  local force_wr="$force_war_room"
  [[ "${WF_FORCE_WAR_ROOM:-0}" == "1" ]] && force_wr="true"

  # Phase 0: War Room (auto-gated by complexity)
  if [[ "$merge_only" == "true" ]]; then
    cmd_war_room merge
    echo -e "${CYAN}→ War Room merged. Tiếp tục chạy: ${BOLD}flowctl cursor-dispatch${NC}\n"
    return 0
  fi

  _wf_cursor_dispatch_persist_flags "$step" "$high_risk" "$impacted_modules"

  if [[ "$skip_war_room" == "false" ]]; then
    local score
    score=$(wf_complexity_score "$step")
    if [[ "$force_wr" == "true" ]] || [[ "$score" -ge "$thr" ]]; then
      echo -e "${MAGENTA}${BOLD}[cursor-dispatch]${NC} Complexity=$score/5 (threshold=$thr${force_wr:+; force-war-room}) → War Room trước khi dispatch team\n"
      cmd_war_room
      wf_dispatch_count_bump "$step"
      echo -e "${YELLOW}⏸  Chờ War Room hoàn thành, sau đó:${NC}"
      echo -e "  ${BOLD}flowctl cursor-dispatch --merge${NC} (merge war room outputs)"
      echo -e "  ${BOLD}flowctl cursor-dispatch --skip-war-room${NC} (bỏ qua, dispatch thẳng)\n"
      return 0
    else
      echo -e "${GREEN}[cursor-dispatch]${NC} Complexity=$score/5 (< $thr) → Skip War Room, dispatch ngay\n"
      # Still generate a simple context digest
      local wr_dir="$DISPATCH_BASE/step-$step/war-room"
      wf_ensure_dir "$wr_dir"
      _war_room_generate_digest "$step" "$(wf_get_step_name "$step")" "$wr_dir" "simple"
    fi
  fi

  wf_dispatch_count_bump "$step"

  # Phase A: Generate briefs + spawn board
  echo -e "${BLUE}[cursor-dispatch]${NC} Generating briefs..."
  cmd_dispatch --dry-run --headless 2>/dev/null || true

  local dispatch_dir="$DISPATCH_BASE/step-$step"
  local reports_dir="$dispatch_dir/reports"
  wf_ensure_dir "$reports_dir"

  local step_name
  step_name=$(wf_get_step_name "$step")

  local roles_json
  roles_json=$(python3 -c "
import json
d = json.load(open('$STATE_FILE'))
s = d['steps']['$step']
roles = [s['agent']] + [r for r in s.get('support_agents',[]) if r != s['agent']]
print(json.dumps(roles))
")

  _cursor_spawn_board "$step" "$step_name" "$dispatch_dir" "$reports_dir" "$roles_json"
}

# ── Spawn Board ────────────────────────────────────────────────

_cursor_spawn_board() {
  local step="$1"
  local step_name="$2"
  local dispatch_dir="$3"
  local reports_dir="$4"
  local roles_json="$5"

  local digest_file="$dispatch_dir/context-digest.md"
  local has_digest="false"
  [[ -f "$digest_file" ]] && has_digest="true"

  echo ""
  echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}${BOLD}║  🚀 CURSOR SPAWN BOARD — Phase A — Step $step: $step_name${NC}"
  echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Briefs:         ${CYAN}${dispatch_dir#$REPO_ROOT/}/${NC}"
  echo -e "  Reports:        ${CYAN}${reports_dir#$REPO_ROOT/}/${NC}"
  if [[ "$has_digest" == "true" ]]; then
    echo -e "  Context digest: ${GREEN}${digest_file#$REPO_ROOT/}${NC} ✓"
  fi
  echo ""

  # ── MODE A: Cursor 3 Agent Tabs ──
  echo -e "${YELLOW}${BOLD}▶ MODE A — Cursor Agent Tabs (Cmd+Shift+I)${NC}"
  echo ""

  local idx=1
  python3 -c "
import json, os
roles = json.loads('$roles_json')
dispatch_dir = '$dispatch_dir'
step = '$step'
repo_root = '$REPO_ROOT'

for role in roles:
    brief_path = os.path.join(dispatch_dir, f'{role}-brief.md')
    report_path = os.path.join(dispatch_dir, 'reports', f'{role}-report.md').replace(repo_root + '/', '')
    rel_brief = brief_path.replace(repo_root + '/', '')
    exists = os.path.isfile(brief_path)
    status = '✓' if exists else '⚠ missing'
    print(f'ROLE|{role}|{rel_brief}|{report_path}|{status}')
" | while IFS='|' read -r _ role rel_brief report_path status; do
    echo -e "  ${BOLD}━━━ [Tab $idx] @$role ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Brief:  ${CYAN}$rel_brief${NC} $status"
    echo -e "  Report: ${CYAN}$report_path${NC}"
    echo ""
    echo -e "  ${GREEN}Paste vào tab mới (sau khi chọn agent '$role'):${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────────┐"
    echo -e "  │ @.cursor/agents/${role}-agent.md                          "
    echo -e "  │ @$rel_brief                                               "
    echo -e "  │ /worker                                                    "
    echo -e "  └────────────────────────────────────────────────────────────┘"
    echo ""
    idx=$((idx + 1))
  done

  # ── MODE B: Task Tool ──
  echo -e "${YELLOW}${BOLD}▶ MODE B — Task Tool Subagents (PM agent tự spawn)${NC}"
  echo ""
  python3 -c "
import json, os
roles = json.loads('$roles_json')
dispatch_dir = '$dispatch_dir'
step = '$step'
repo_root = '$REPO_ROOT'

for role in roles:
    brief_path = os.path.join(dispatch_dir, f'{role}-brief.md').replace(repo_root + '/', '')
    report_abs  = os.path.join(dispatch_dir, 'reports', f'{role}-report.md')
    report_rel  = os.path.join(dispatch_dir, 'reports', f'{role}-report.md').replace(repo_root + '/', '')
    reports_dir = os.path.join(dispatch_dir, 'reports')
    print(f'  Spawn @{role}:')
    print(f'    subagent_type: {role}')
    print(f'    description: Execute step-{step} tasks as @{role}')
    print(f'    instructions: Read @{brief_path} then execute.')
    print(f'      Write report to ABSOLUTE path: {report_abs}')
    print(f'      (relative from project root: {report_rel})')
    print(f'      Run first if dir missing: mkdir -p {reports_dir}')
    print()
"

  if [[ "$STATE_FILE" == *"/.flowctl/flows/"* ]]; then
    echo -e "${YELLOW}Multi-flow state:${NC} trước khi chạy ${BOLD}flowctl${NC} trong terminal, export:"
    echo -e "  ${BOLD}export FLOWCTL_STATE_FILE=\"$STATE_FILE\"${NC}"
    echo ""
  fi

  # ── Collect instructions ──
  echo -e "${MAGENTA}${BOLD}━━━ Khi tất cả agents hoàn thành: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${BOLD}flowctl collect${NC}"
  echo -e "  (collect sẽ tự phát hiện NEEDS_SPECIALIST → Phase B nếu cần)"
  echo ""

  # Write board to file
  local board_file="$dispatch_dir/spawn-board.txt"
  {
    echo "CURSOR SPAWN BOARD — Step $step: $step_name"
    echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Roles: $(python3 -c "import json; print(', '.join(json.loads('$roles_json')))")"
    echo "Context digest: $has_digest"
    if [[ "$STATE_FILE" == *"/.flowctl/flows/"* ]]; then
      echo "FLOWCTL_STATE_FILE=$STATE_FILE"
    fi
  } > "$board_file"

  echo -e "  Spawn board saved: ${CYAN}${board_file#$REPO_ROOT/}${NC}\n"
}
