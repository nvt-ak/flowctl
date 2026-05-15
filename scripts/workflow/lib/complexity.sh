#!/usr/bin/env bash
# complexity.sh — Score step complexity để quyết định War Room (no auto +2 for code steps)

# Returns: integer 1-5
wf_complexity_score() {
  local step="${1:-}"
  [[ -z "$step" ]] && step=$(wf_json_get "current_step")

  python3 - <<PY
import json
from pathlib import Path

state_path = Path("$STATE_FILE")
data = json.loads(state_path.read_text(encoding="utf-8"))
step = str($step)
s = data["steps"].get(step, {})
dr = s.get("dispatch_risk") or {}

score = 1

# Roles: single +1 when 3+ distinct agents (reduced weight vs legacy +2 for 4+)
primary = s.get("agent", "")
supports = [a for a in s.get("support_agents", []) if a and a != primary]
n_roles = 1 + len(supports)
if n_roles >= 3:
    score += 1

# PM-set risk flags (optional in flowctl-state.json)
if dr.get("high_risk") is True:
    score += 2
im = dr.get("impacted_modules")
if isinstance(im, int) and im > 2:
    score += 2

# Open blockers from prior steps (carry-over)
open_blockers = 0
for sn, sobj in data["steps"].items():
    if int(sn) < int(step):
        for b in sobj.get("blockers", []):
            if not b.get("resolved"):
                open_blockers += 1
if open_blockers > 0:
    score += 1

# First cursor-dispatch evaluation for this step (see cursor_dispatch.sh bump)
if int(dr.get("dispatch_count", 0) or 0) == 0:
    score += 1

score = max(1, min(5, score))
print(score)
PY
}

wf_complexity_tier() {
  local score="$1"
  if [[ "$score" -le 1 ]]; then
    echo "MICRO"
  elif [[ "$score" -le 3 ]]; then
    echo "STANDARD"
  else
    echo "FULL"
  fi
}

# Bump dispatch_count for current step (after scoring / gating). Idempotent per call site.
wf_dispatch_count_bump() {
  local step="${1:-}"
  [[ -z "$step" ]] && step=$(wf_json_get "current_step")
  WF_STATE_FILE="$STATE_FILE" WF_STEP="$step" python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path(os.environ["WF_STATE_FILE"])
step = str(os.environ["WF_STEP"])
data = json.loads(path.read_text(encoding="utf-8"))
s = data.setdefault("steps", {}).setdefault(step, {})
dr = s.setdefault("dispatch_risk", {})
dr["dispatch_count"] = int(dr.get("dispatch_count", 0) or 0) + 1
path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
PY
}

wf_complexity_print_hints() {
  local repo="${1:-$REPO_ROOT}"
  # Graphify: read-only suggestion
  local gpath="$repo/graphify-out/graph.json"
  if [[ -f "$gpath" ]]; then
    python3 - <<PY
import json
from pathlib import Path
p = Path("$gpath")
try:
    g = json.loads(p.read_text(encoding="utf-8"))
except Exception as e:
    print(f"  [hint/graphify] Could not read graph.json: {e}")
    raise SystemExit(0)
nodes = g.get("nodes") or {}
communities = g.get("communities") or g.get("clusters") or []
n = len(nodes) if isinstance(nodes, dict) else len(nodes)
c = len(communities) if isinstance(communities, list) else 0
print(f"  [hint/graphify] ~{n} nodes — communities/clusters ~{c} (read-only; use for scope — set --impacted-modules if PM agrees)")
PY
  else
    echo "  [hint/graphify] graphify-out/graph.json not found — skip or run graphify index"
  fi
  # Git: light hint from changed paths (read-only)
  if git -C "$repo" rev-parse --is-inside-work-tree &>/dev/null; then
    python3 - <<PY
import subprocess
from pathlib import Path
repo = Path("$repo")
try:
    out = subprocess.check_output(
        ["git", "-C", str(repo), "diff", "--name-only", "HEAD"],
        text=True,
        stderr=subprocess.DEVNULL,
    )
except Exception:
    out = ""
roots = set()
for line in out.splitlines():
    line = line.strip()
    if not line or line.startswith("dev/null"):
        continue
    roots.add(line.split("/")[0])
n = len(roots)
print(f"  [hint/git] ~{n} top-level roots in changed paths vs HEAD (read-only; PM sets --impacted-modules)")
PY
  fi
}

cmd_complexity() {
  local step
  step=$(wf_require_initialized_workflow)
  local score
  score=$(wf_complexity_score "$step")
  local tier
  tier=$(wf_complexity_tier "$score")

  local thr="${WF_WAR_ROOM_THRESHOLD:-4}"

  local label verdict color
  case "$tier" in
    MICRO)
      label="MICRO"; color="$GREEN"
      verdict="1 agent, light ceremony → PM assign trực tiếp"
      ;;
    STANDARD)
      label="STANDARD"; color="$YELLOW"
      verdict="Score 2–3: brief + report; War Room khi score ≥ ${thr} (mặc định)"
      ;;
    FULL)
      label="FULL"; color="$RED"
      verdict="Score 4–5: War Room (PM + TechLead) trước khi dispatch full team (ngưỡng ${thr})"
      ;;
  esac

  echo -e "\n${BOLD}Complexity Score — Step $step${NC}"
  echo -e "  Score : ${color}${BOLD}$score / 5${NC} ($label)"
  echo -e "  Tier  : ${color}${BOLD}$tier${NC}"
  echo -e "  War Room threshold: ${BOLD}${thr}${NC} (WF_WAR_ROOM_THRESHOLD)"
  echo -e "  Action: $verdict\n"

  echo -e "${BOLD}Hybrid hints (read-only, không ghi state):${NC}"
  wf_complexity_print_hints "$REPO_ROOT"
  echo ""
}
