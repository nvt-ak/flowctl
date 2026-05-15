#!/usr/bin/env bash
# Create or resolve flows-first state for `flowctl init` (see plan-flows-first.md).

_bootstrap_init_flow() {
  local project_name="$1" overwrite="$2"
  local flows_json="$REPO_ROOT/.flowctl/flows.json"
  local template_state="$WORKFLOW_ROOT/templates/flowctl-state.template.json"
  [[ -f "$template_state" ]] || { wf_error "Thiếu template: $template_state"; exit 1; }

  if [[ "$overwrite" == "true" && -f "$flows_json" ]]; then
    local _active_sf
    _active_sf="$(
      WF_FLOWS_JSON="$flows_json" python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ["WF_FLOWS_JSON"])
idx = json.loads(p.read_text(encoding="utf-8"))
fid = idx.get("active_flow_id", "")
meta = (idx.get("flows") or {}).get(fid, {})
print(meta.get("state_file", "") if isinstance(meta, dict) else "")
PY
    )" 2>/dev/null || _active_sf=""
    if [[ -n "$_active_sf" ]]; then
      local _abs_sf="$REPO_ROOT/$_active_sf"
      if [[ -f "$_abs_sf" ]]; then
        local _fid_keep
        _fid_keep="$(
          WF_STATE="$_abs_sf" python3 - <<'PY'
import json, os
from pathlib import Path
try:
    d = json.loads(Path(os.environ["WF_STATE"]).read_text(encoding="utf-8"))
    print(d.get("flow_id", "") or "")
except Exception:
    print("")
PY
        )" 2>/dev/null || _fid_keep=""
        cp "$template_state" "$_abs_sf"
        WF_DEST="$_abs_sf" WF_PROJECT_NAME="$project_name" WF_FLOW_ID="$_fid_keep" python3 - <<'PY'
import json, os, datetime
from pathlib import Path
p = Path(os.environ["WF_DEST"])
d = json.loads(p.read_text(encoding="utf-8"))
fid = (os.environ.get("WF_FLOW_ID") or "").strip()
if fid:
    d["flow_id"] = fid
d["project_name"] = os.environ["WF_PROJECT_NAME"]
d["overall_status"] = "in_progress"
d["current_step"] = 1
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
d["created_at"] = d["updated_at"] = now
p.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
PY
        export STATE_FILE="$_abs_sf"
        wf_success "Flow reset: $_active_sf (flow_id preserved)"
        return 0
      fi
    fi
  fi

  if [[ -f "$flows_json" ]]; then
    local _existing_abs
    _existing_abs="$(
      REPO_ROOT="$REPO_ROOT" WF_FLOWS_JSON="$flows_json" python3 - <<'PY'
import json, os
from pathlib import Path
repo = Path(os.environ["REPO_ROOT"])
p = Path(os.environ["WF_FLOWS_JSON"])
idx = json.loads(p.read_text(encoding="utf-8"))
fid = idx.get("active_flow_id") or ""
meta = (idx.get("flows") or {}).get(fid)
if not isinstance(meta, dict):
    raise SystemExit(0)
sf = (meta.get("state_file") or "").strip()
if not sf:
    raise SystemExit(0)
dest = (repo / sf).resolve()
if dest.is_file():
    print(dest)
PY
    )" 2>/dev/null || _existing_abs=""
    if [[ -n "$_existing_abs" && -f "$_existing_abs" ]]; then
      export STATE_FILE="$_existing_abs"
      return 0
    fi
  fi

  mkdir -p "$REPO_ROOT/.flowctl"
  local out_json
  out_json="$(
    WF_TEMPLATE="$template_state" WF_LABEL="" WF_PROJECT_NAME="$project_name" python3 - <<'PY'
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
  )" || { wf_error "init bootstrap: python scaffold failed"; exit 1; }

  local fid short rel dest
  fid="$(echo "$out_json" | python3 -c "import json,sys;print(json.load(sys.stdin)['flow_id'])")"
  short="$(echo "$out_json" | python3 -c "import json,sys;print(json.load(sys.stdin)['short'])")"
  rel=".flowctl/flows/$short/state.json"
  dest="$REPO_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  echo "$out_json" | python3 -c "import json,sys;json.dump(json.load(sys.stdin)['state'],open(sys.argv[1],'w',encoding='utf-8'),indent=2,ensure_ascii=False)" "$dest"

  if [[ ! -f "$flows_json" ]]; then
    WF_FLOWS_JSON="$flows_json" WF_FID="$fid" WF_REL="$rel" WF_LABEL="" python3 - <<'PY'
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
    WF_FLOWS_JSON="$flows_json" WF_FID="$fid" WF_REL="$rel" WF_LABEL="" python3 - <<'PY'
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

  export STATE_FILE="$dest"
  wf_success "Khởi tạo flow: $fid → $dest"
}
