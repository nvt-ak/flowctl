#!/usr/bin/env bash
# Multi-flow CLI: list / new / switch — state files under .flowctl/flows/ + .flowctl/flows.json

FLOWCTL_FLOWS_JSON="$REPO_ROOT/.flowctl/flows.json"
_FLOWS_INDEX_LOCK_DIR=""

_wf_try_acquire_flows_index_lock_once() {
  _FLOWS_INDEX_LOCK_DIR="$REPO_ROOT/.flowctl/flows.new.lock"
  if mkdir "$_FLOWS_INDEX_LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$_FLOWS_INDEX_LOCK_DIR/pid"
    return 0
  fi

  local holder="unknown"
  if [[ -f "$_FLOWS_INDEX_LOCK_DIR/pid" ]]; then
    holder="$(<"$_FLOWS_INDEX_LOCK_DIR/pid")"
  fi
  local _stale=false
  if [[ "$holder" =~ ^[1-9][0-9]*$ ]]; then
    kill -0 "$holder" 2>/dev/null || _stale=true
  else
    _stale=true
  fi
  if $_stale; then
    rm -rf "$_FLOWS_INDEX_LOCK_DIR" 2>/dev/null || true
    if mkdir "$_FLOWS_INDEX_LOCK_DIR" 2>/dev/null; then
      echo "$$" > "$_FLOWS_INDEX_LOCK_DIR/pid"
      return 0
    fi
  fi
  return 1
}

_wf_release_flows_index_lock() {
  if [[ -n "$_FLOWS_INDEX_LOCK_DIR" ]]; then
    rm -rf "$_FLOWS_INDEX_LOCK_DIR" 2>/dev/null || true
    _FLOWS_INDEX_LOCK_DIR=""
  fi
}

# Serialize flows.json read-modify-write (flow new, fork). Retries for concurrent callers.
_wf_acquire_flows_index_lock() {
  local max_retries="${1:-40}"
  local attempt=0
  while [[ "$attempt" -lt "$max_retries" ]]; do
    if _wf_try_acquire_flows_index_lock_once; then
      trap '_wf_release_flows_index_lock' EXIT
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "0.0$(( (RANDOM % 9) + 1 ))"
  done
  return 1
}

cmd_flow_list() {
  if [[ ! -f "$FLOWCTL_FLOWS_JSON" ]]; then
    wf_info "Chưa có .flowctl/flows.json — chạy: ${WORKFLOW_CLI_CMD} init hoặc ${WORKFLOW_CLI_CMD} flow new"
    wf_info "STATE_FILE (resolved): ${STATE_FILE:-<empty>}"
    return 0
  fi
  python3 - "$FLOWCTL_FLOWS_JSON" "$STATE_FILE" <<'PY'
import json, sys
from pathlib import Path
flows_p = Path(sys.argv[1])
state_res = Path(sys.argv[2])
idx = json.loads(flows_p.read_text(encoding="utf-8"))
active = idx.get("active_flow_id", "")
print("active_flow_id:", active)
print("resolved_state_file:", state_res)
print("flows:")
for fid, meta in sorted((idx.get("flows") or {}).items()):
    if not isinstance(meta, dict):
        continue
    lab = meta.get("label") or ""
    sf = meta.get("state_file", "")
    mark = " <-- active" if fid == active else ""
    print(f"  {fid}  label={lab!r}  state_file={sf}{mark}")
PY
}

cmd_flow_switch() {
  wf_acquire_flow_lock
  local target="${1:-}"
  if [[ -z "$target" ]]; then
    wf_error "Thiếu flow id (prefix wf-... hoặc 8 ký tự hex)."
    wf_info "Usage: flowctl flow switch <flow_id_or_prefix>"
    exit 1
  fi
  [[ -f "$FLOWCTL_FLOWS_JSON" ]] || { wf_error "Không tìm thấy $FLOWCTL_FLOWS_JSON — chạy: flowctl flow new trước"; exit 1; }
  local _py_rc=0
  WF_FLOWS_JSON="$FLOWCTL_FLOWS_JSON" WF_TARGET="$target" python3 - <<'PY' || _py_rc=$?
import json, os, sys
from pathlib import Path
p = Path(os.environ["WF_FLOWS_JSON"])
target = os.environ["WF_TARGET"].strip()
idx = json.loads(p.read_text(encoding="utf-8"))
flows = idx.get("flows") or {}
keys = list(flows.keys())
match = None
if target in flows:
    match = target
else:
    tnd = target.replace("wf-", "").replace("-", "")
    for k in keys:
        knd = k.replace("wf-", "").replace("-", "")
        if k == target or k.startswith(target) or (tnd and (knd.startswith(tnd) or k.startswith("wf-" + tnd[:8]))):
            match = k
            break
    if not match and tnd:
        for k in keys:
            if tnd in k.replace("wf-", "").replace("-", ""):
                match = k
                break
if not match:
    print(f"No flow matches {target!r}. Known: {keys}", file=sys.stderr)
    sys.exit(1)
idx["active_flow_id"] = match
p.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"active_flow_id set to {match}")
PY
  [[ "$_py_rc" -eq 0 ]] || exit "$_py_rc"
  wf_success "Đã switch flow. MCP/terminal mới: export FLOWCTL_ACTIVE_FLOW= hoặc reload; wf_state đọc từ resolve."
}

cmd_flow_new() {
  # NOTE: do NOT acquire the main flow lock here.
  # `flow new` only writes to flows.json and a brand-new state file — it never
  # touches the currently-active state file.  Holding the current flow lock
  # would block parallel-window users from creating an independent flow while
  # another flowctl command is running in a different terminal.
  # Lightweight per-flows.json advisory lock (no main workflow lock).
  if ! _wf_acquire_flows_index_lock; then
    wf_warn "flows.json đang được cập nhật bởi tiến trình khác. Thử lại sau."
    exit 1
  fi
  local label="" proj_name=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) label="${2:-}"; shift 2 ;;
      --project) proj_name="${2:-}"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [[ -z "$proj_name" && -f "$STATE_FILE" ]]; then
    proj_name="$(python3 -c "import json;print(json.load(open('$STATE_FILE',encoding='utf-8')).get('project_name','') or '')" 2>/dev/null || true)"
  fi
  mkdir -p "$REPO_ROOT/.flowctl"
  local template_state="$WORKFLOW_ROOT/templates/flowctl-state.template.json"
  [[ -f "$template_state" ]] || { wf_error "Thiếu template: $template_state"; exit 1; }

  if [[ -z "$proj_name" ]]; then
    proj_name="Project"
  fi
  local out_json
  out_json="$(
    WF_TEMPLATE="$template_state" WF_LABEL="$label" WF_PROJECT_NAME="$proj_name" python3 - <<'PY'
import json, os, uuid, datetime
from pathlib import Path
tpl = Path(os.environ["WF_TEMPLATE"])
proj = os.environ.get("WF_PROJECT_NAME", "Project").strip() or "Project"
label = os.environ.get("WF_LABEL", "").strip()
flow_id = f"wf-{uuid.uuid4()}"
short = str(uuid.uuid4()).replace("-", "")[:10]
data = json.loads(tpl.read_text(encoding="utf-8"))
data["flow_id"] = flow_id
data["project_name"] = proj
if label:
    data["project_description"] = label
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
data["created_at"] = data.get("created_at") or now
data["updated_at"] = now
print(json.dumps({"flow_id": flow_id, "short": short, "state": data}, ensure_ascii=False))
PY
  )" || { wf_error "flow new: python scaffold failed"; exit 1; }

  local fid short rel dest
  fid="$(echo "$out_json" | python3 -c "import json,sys;print(json.load(sys.stdin)['flow_id'])")"
  short="$(echo "$out_json" | python3 -c "import json,sys;print(json.load(sys.stdin)['short'])")"
  rel=".flowctl/flows/$short/state.json"
  dest="$REPO_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  echo "$out_json" | python3 -c "import json,sys;json.dump(json.load(sys.stdin)['state'],open(sys.argv[1],'w',encoding='utf-8'),indent=2,ensure_ascii=False)" "$dest"

  if [[ ! -f "$FLOWCTL_FLOWS_JSON" ]]; then
    WF_FLOWS_JSON="$FLOWCTL_FLOWS_JSON" WF_FID="$fid" WF_REL="$rel" WF_LABEL="$label" python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ["WF_FLOWS_JSON"])
fid = os.environ["WF_FID"]
rel = os.environ["WF_REL"]
label = os.environ.get("WF_LABEL", "").strip()
idx = {"version": 1, "active_flow_id": fid, "flows": {fid: {"state_file": rel, "label": label}}}
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY
  else
    WF_FLOWS_JSON="$FLOWCTL_FLOWS_JSON" WF_FID="$fid" WF_REL="$rel" WF_LABEL="$label" python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ["WF_FLOWS_JSON"])
fid = os.environ["WF_FID"]
rel = os.environ["WF_REL"]
label = os.environ.get("WF_LABEL", "").strip()
idx = json.loads(p.read_text(encoding="utf-8"))
idx.setdefault("flows", {})[fid] = {"state_file": rel, "label": label}
idx["active_flow_id"] = fid
p.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY
  fi

  wf_success "flow mới: $fid → $dest (active). Resolver: .flowctl/flows.json"
  wf_info "Song song: terminal khác → export FLOWCTL_STATE_FILE=$dest"
}

cmd_flow() {
  local sub="${1:-list}"
  shift || true
  case "$sub" in
    list|ls) cmd_flow_list ;;
    new) cmd_flow_new "$@" ;;
    switch|sw) cmd_flow_switch "$@" ;;
    *)
      wf_error "Subcommand flow không hợp lệ: $sub"
      wf_info "Usage: flowctl flow list | flowctl flow new [--label L] [--project N] | flowctl flow switch <flow_id>"
      exit 1
      ;;
  esac
}
