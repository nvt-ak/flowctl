#!/usr/bin/env bash

wf_acquire_flow_lock() {
  if mkdir "$WORKFLOW_LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$WORKFLOW_LOCK_DIR/pid"
    trap wf_release_flow_lock EXIT
    return 0
  fi

  local holder="unknown"
  if [[ -f "$WORKFLOW_LOCK_DIR/pid" ]]; then
    holder="$(<"$WORKFLOW_LOCK_DIR/pid")"
  fi
  # Determine if the lock is stale and can be reclaimed:
  # - Numeric PID > 0 with a dead process → stale
  # - Non-numeric holder (e.g. "released") → stale sentinel left by release fallback
  local _stale=false
  if [[ "$holder" =~ ^[1-9][0-9]*$ ]]; then
    kill -0 "$holder" 2>/dev/null || _stale=true
  elif ! [[ "$holder" =~ ^[1-9][0-9]*$ ]]; then
    # Non-positive or non-numeric: treat as stale (released sentinel or corrupt)
    _stale=true
  fi
  if $_stale; then
    # Stale lock: attempt clean removal first, then fall back to pid overwrite
    # (rm -rf can fail on some filesystems/sandboxes even when pid is writable)
    if rm -rf "$WORKFLOW_LOCK_DIR" 2>/dev/null && mkdir "$WORKFLOW_LOCK_DIR" 2>/dev/null; then
      echo "$$" > "$WORKFLOW_LOCK_DIR/pid"
      trap wf_release_flow_lock EXIT
      echo -e "${YELLOW}Reclaimed stale flowctl lock from pid=$holder.${NC}"
      return 0
    elif echo "$$" > "$WORKFLOW_LOCK_DIR/pid" 2>/dev/null; then
      # Dir persists (undeletable), but we own it now via pid overwrite
      trap wf_release_flow_lock EXIT
      echo -e "${YELLOW}Reclaimed stale flowctl lock from pid=$holder.${NC}"
      return 0
    fi
    local new_holder="unknown"
    if [[ -f "$WORKFLOW_LOCK_DIR/pid" ]]; then
      new_holder="$(<"$WORKFLOW_LOCK_DIR/pid")"
    fi
    echo -e "${RED}Workflow lock đang được giữ bởi pid=$new_holder. Thử lại sau.${NC}"
    _wf_lock_hint
    exit 1
  fi
  echo -e "${RED}Workflow lock đang được giữ bởi pid=$holder. Thử lại sau.${NC}"
  _wf_lock_hint
  exit 1
}

# Helper: print actionable hint when a lock conflict is detected.
_wf_lock_hint() {
  echo -e "${YELLOW}  → Để chạy task song song trong window khác, tạo flow riêng:${NC}"
  echo -e "${YELLOW}      flowctl flow new --label <tên-task>${NC}"
  echo -e "${YELLOW}      flowctl flow list            # xem flow_id vừa tạo${NC}"
  echo -e "${YELLOW}      export FLOWCTL_ACTIVE_FLOW=<flow_id>  # trong window mới${NC}"
  echo -e "${YELLOW}      flowctl start${NC}"
  echo -e "${YELLOW}  → Hoặc dùng FLOWCTL_STATE_FILE riêng: FLOWCTL_STATE_FILE=./.flowctl/flows/<short>/state.json flowctl start${NC}"
}

wf_release_flow_lock() {
  if ! rm -rf "$WORKFLOW_LOCK_DIR" 2>/dev/null; then
    # Fallback: overwrite pid with a non-numeric sentinel so the next acquire
    # treats this as a stale (releasable) lock via the non-numeric branch below.
    echo "released" > "$WORKFLOW_LOCK_DIR/pid" 2>/dev/null || true
  fi
}

# Backward-compatible aliases (Phase 5.2)
acquire_flow_lock() { wf_warn_deprecated "acquire_flow_lock" "wf_acquire_flow_lock"; wf_acquire_flow_lock "$@"; }
release_flow_lock() { wf_warn_deprecated "release_flow_lock" "wf_release_flow_lock"; wf_release_flow_lock "$@"; }
