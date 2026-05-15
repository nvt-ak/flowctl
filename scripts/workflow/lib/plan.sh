#!/usr/bin/env bash
# plan.sh — Generate workflows/plans/plan.md from flowctl state (view, not source of truth)

_plan_output_dir() {
  if [[ "$DISPATCH_BASE" == */dispatch ]]; then
    echo "${DISPATCH_BASE%/dispatch}/plans"
  else
    echo "$REPO_ROOT/workflows/plans"
  fi
}

_generate_plan_md() {
  local plan_dir
  plan_dir="$(_plan_output_dir)"
  mkdir -p "$plan_dir"
  local plan_file="$plan_dir/plan.md"
  local notes_file="$plan_dir/plan-notes.md"
  local preserve_notes=""

  if [[ -f "$plan_file" && -f "$notes_file" ]]; then
    preserve_notes="$(cat "$notes_file" 2>/dev/null || true)"
  elif [[ -f "$plan_file" ]]; then
    preserve_notes="$(WF_OLD_PLAN="$plan_file" python3 - <<'PY' 2>/dev/null || true
from pathlib import Path
import os
p = Path(os.environ["WF_OLD_PLAN"])
if not p.is_file():
    raise SystemExit(0)
text = p.read_text(encoding="utf-8")
marker = "\n## Notes\n"
if marker in text:
    print(text.split(marker, 1)[1].strip())
PY
)"
  fi

  WF_STATE_FILE="$STATE_FILE" WF_PLAN_FILE="$plan_file" WF_REPO="$REPO_ROOT" \
  WF_CLI_CMD="$WORKFLOW_CLI_CMD" \
  python3 - <<'PY'
import json
import os
from datetime import datetime
from pathlib import Path

state_path = Path(os.environ["WF_STATE_FILE"])
plan_path = Path(os.environ["WF_PLAN_FILE"])
repo = Path(os.environ["WF_REPO"])
cli = os.environ.get("WF_CLI_CMD", "flowctl")

data = json.loads(state_path.read_text(encoding="utf-8"))
project = data.get("project_name", "")
flow_id = data.get("flow_id", "")
now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

lines = [
    f"# Project Plan — {project}",
    f"_Generated from flowctl state at {now} — single source of truth_",
    f"_Regenerate: `{cli} generate-plan` or `{cli} plan`_",
    "",
    "## Active Steps",
    "| Step | Name | Agent | Status |",
    "|------|------|-------|--------|",
]

for n in range(1, 10):
    s = data.get("steps", {}).get(str(n), {})
    if not s:
        continue
    name = s.get("name", "")
    agent = s.get("agent", "")
    status = s.get("status", "pending")
    if status == "skipped":
        lines.append(f"| ~~{n}~~ | ~~{name}~~ | ~~@{agent}~~ | ⊘ skipped |")
    else:
        icon = {
            "completed": "✅ approved",
            "in_progress": "⏳ in progress",
            "pending": "⏳ pending",
        }.get(status, status)
        lines.append(f"| {n} | {name} | @{agent} | {icon} |")

lines.extend(["", "## Decisions (from state)", ""])
decisions_any = False
for n in range(1, 10):
    for d in data.get("steps", {}).get(str(n), {}).get("decisions") or []:
        if isinstance(d, dict) and d.get("type") != "rejection":
            decisions_any = True
            desc = (d.get("description") or "")[:300]
            lines.append(f"- Step {n}: {desc}")
if not decisions_any:
    lines.append("- (none yet)")

lines.extend(["", "## Open Blockers", ""])
blockers_any = False
for n, s in data.get("steps", {}).items():
    for b in s.get("blockers") or []:
        if isinstance(b, dict) and not b.get("resolved"):
            blockers_any = True
            lines.append(f"- Step {n}: {(b.get('description') or '')[:200]}")
if not blockers_any:
    lines.append("- (none)")

lines.extend(
    [
        "",
        "## Progress",
        f"Current step: **{data.get('current_step', '?')}** | Overall: **{data.get('overall_status', '?')}**",
        f"Flow ID: `{flow_id}`",
        "",
        f"Status command: `{cli} status`",
    ]
)

plan_path.parent.mkdir(parents=True, exist_ok=True)
plan_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

  if [[ -n "$preserve_notes" ]]; then
    printf '%s\n' "$preserve_notes" > "$notes_file"
    {
      echo ""
      echo "## Notes (human-editable — preserved in plan-notes.md)"
      echo ""
      echo "$preserve_notes"
    } >> "$plan_file"
  fi

  echo "$plan_file"
}

cmd_generate_plan() {
  wf_require_initialized_workflow > /dev/null
  local plan_file
  plan_file="$(_generate_plan_md)"
  wf_success "Plan generated: ${plan_file#$REPO_ROOT/}"
}

cmd_plan() {
  case "${1:-}" in
    --regenerate|-r|"") shift; cmd_generate_plan "$@" ;;
    *)
      wf_error "Usage: ${WORKFLOW_CLI_CMD} plan [--regenerate]"
      exit 1
      ;;
  esac
}
