#!/usr/bin/env bash

wf_traceability_append_event() {
  local event_id="$1"
  local event_type="$2"
  local payload_json="$3"
  WF_TRACEABILITY_FILE="$TRACEABILITY_FILE" WF_EVENT_ID="$event_id" WF_EVENT_TYPE="$event_type" WF_PAYLOAD_JSON="$payload_json" python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

path = Path(os.environ["WF_TRACEABILITY_FILE"])
event_id = os.environ["WF_EVENT_ID"]
event_type = os.environ["WF_EVENT_TYPE"]
payload = json.loads(os.environ["WF_PAYLOAD_JSON"])
path.parent.mkdir(parents=True, exist_ok=True)

existing_ids = set()
if path.exists():
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s:
            continue
        try:
            row = json.loads(s)
        except Exception:
            continue
        rid = row.get("event_id")
        if rid:
            existing_ids.add(rid)

if event_id in existing_ids:
    print(f"TRACE_SKIPPED|event_id={event_id}")
    raise SystemExit(0)

row = {
    "event_id": event_id,
    "event_type": event_type,
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
row.update(payload)
with path.open("a", encoding="utf-8") as f:
    f.write(json.dumps(row, ensure_ascii=False) + "\n")
print(f"TRACE_ADDED|event_id={event_id}")
PY
}

wf_traceability_record_task() {
  local step="$1"
  local role="$2"
  local report_rel="$3"
  local evidence_manifest_rel="$4"
  WF_STATE_FILE="$STATE_FILE" WF_IDEMPOTENCY_FILE="$IDEMPOTENCY_FILE" WF_STEP="$step" WF_ROLE="$role" WF_REPORT="$report_rel" WF_MANIFEST="$evidence_manifest_rel" python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

state_path = Path(os.environ["WF_STATE_FILE"])
idem_path = Path(os.environ["WF_IDEMPOTENCY_FILE"])
step = str(os.environ["WF_STEP"])
role = os.environ["WF_ROLE"]
report_rel = os.environ["WF_REPORT"]
manifest_rel = os.environ["WF_MANIFEST"]

state = json.loads(state_path.read_text(encoding="utf-8"))
step_obj = state.get("steps", {}).get(step, {})
idem = json.loads(idem_path.read_text(encoding="utf-8")) if idem_path.exists() else {}
key = f"step:{step}:role:{role}:mode:headless"
idem_entry = idem.get(key, {})

requirement = (state.get("project_name") or "").strip() or "Unnamed project"
task_name = (step_obj.get("name") or "").strip() or f"Step {step}"
flow_id = idem_entry.get("flow_id") or state.get("flow_id") or ""
run_id = idem_entry.get("run_id") or ""
correlation_id = idem_entry.get("correlation_id") or ""

event_id_raw = f"task|{step}|{role}|{report_rel}|{run_id or 'no-run'}"
event_id = hashlib.sha256(event_id_raw.encode("utf-8")).hexdigest()[:24]

payload = {
    "flow_id": flow_id,
    "step": int(step),
    "role": role,
    "requirement": requirement,
    "task": task_name,
    "run_id": run_id,
    "correlation_id": correlation_id,
    "evidence": {
        "report_path": report_rel,
        "manifest_path": manifest_rel,
    },
}
print(json.dumps({"event_id": event_id, "payload": payload}, ensure_ascii=False))
PY
}

wf_traceability_record_approval() {
  local step="$1"
  local approved_by="$2"
  local decision="$3"
  local evidence_manifest_rel="$4"
  WF_STATE_FILE="$STATE_FILE" WF_STEP="$step" WF_APPROVED_BY="$approved_by" WF_DECISION="$decision" WF_MANIFEST="$evidence_manifest_rel" python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

state_path = Path(os.environ["WF_STATE_FILE"])
state = json.loads(state_path.read_text(encoding="utf-8"))
step = str(os.environ["WF_STEP"])
approved_by = os.environ["WF_APPROVED_BY"]
decision = os.environ["WF_DECISION"]
manifest_rel = os.environ["WF_MANIFEST"]
step_obj = state.get("steps", {}).get(step, {})

requirement = (state.get("project_name") or "").strip() or "Unnamed project"
task_name = (step_obj.get("name") or "").strip() or f"Step {step}"
flow_id = state.get("flow_id") or ""
approval_status = (step_obj.get("approval_status") or decision or "").strip()

event_id_raw = f"approval|{step}|{approval_status}|{approved_by}|{manifest_rel}"
event_id = hashlib.sha256(event_id_raw.encode("utf-8")).hexdigest()[:24]

payload = {
    "flow_id": flow_id,
    "step": int(step),
    "requirement": requirement,
    "task": task_name,
    "approval": {
        "status": approval_status,
        "approved_by": approved_by,
        "decision": decision,
    },
    "evidence": {
        "manifest_path": manifest_rel,
        "approval": {
            "approved_at": step_obj.get("approved_at"),
            "approval_status": approval_status,
        },
    },
}
print(json.dumps({"event_id": event_id, "payload": payload}, ensure_ascii=False))
PY
}
