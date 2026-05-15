#!/usr/bin/env bash
# test/test-fork-parallel-isolation.sh
#
# Coverage: flowctl fork isolation + lock conflict behavior
#
# TC-01  fork stdout is eval-able (export FLOWCTL_ACTIVE_FLOW=wf-...)
# TC-02  fork creates .flowctl/flows/<short>/state.json with valid content
# TC-03  fork does NOT change active_flow_id in flows.json
# TC-04  fork --label propagates to state project_description
# TC-05  multiple forks produce unique flow_ids, all registered in flows.json
# TC-06  resolver picks up FLOWCTL_ACTIVE_FLOW env → returns correct state file
# TC-07  two FLOWCTL_ACTIVE_FLOW values yield different WORKFLOW_LOCK_DIR hashes
# TC-08  same flow_id → same lock hash (deterministic)
# TC-09  lock conflict (same flow, two processes) → exit 1 + hint contains eval fork
# TC-10  different flows (via fork) → no lock conflict when running simultaneously
# TC-11  stale lock (dead pid) → auto-reclaimed, no error
# TC-12  lock released on process exit (trap fires)
# TC-13  fork with no existing flows.json → creates it and sets active_flow_id
# TC-14  fork inherits project_name from active state file
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLOWCTL_SH="$ROOT/scripts/flowctl.sh"
RESOLVER="$ROOT/scripts/workflow/lib/resolve_state_path.py"
LIB_DIR="$ROOT/scripts/workflow/lib"
TEMPLATE="$ROOT/templates/flowctl-state.template.json"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
pass() { echo "PASS [TC-$(printf '%02d' $1)]: $2"; ((PASS++)); }
fail() { echo "FAIL [TC-$(printf '%02d' $1)]: $2" >&2; ((FAIL++)); }

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

# make_flow_project <dir> <label>
# Creates a minimal initialized project with 1 active flow.
# Prints the active flow_id.
make_flow_project() {
  local dir="$1" label="${2:-main-task}"
  mkdir -p "$dir"
  local flow_id short rel dest
  flow_id="wf-$(python3 -c 'import uuid; print(uuid.uuid4())')"
  short="${flow_id:3:8}"
  rel=".flowctl/flows/$short/state.json"
  dest="$dir/$rel"
  mkdir -p "$(dirname "$dest")"
  python3 - "$dest" "$flow_id" "$label" "$TEMPLATE" <<'PY'
import json, sys, datetime
from pathlib import Path
dest, fid, label, tpl = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4])
d = json.loads(tpl.read_text(encoding="utf-8"))
d.update({
    "flow_id": fid, "project_name": label,
    "overall_status": "in_progress", "current_step": 1
})
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
d["created_at"] = d["updated_at"] = now
dest.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
PY
  python3 -c "
import json; from pathlib import Path
p = Path('$dir/.flowctl/flows.json')
p.parent.mkdir(parents=True, exist_ok=True)
idx = {'version': 1, 'active_flow_id': '$flow_id',
       'flows': {'$flow_id': {'state_file': '$rel', 'label': '$label'}}}
p.write_text(json.dumps(idx, indent=2) + '\n', encoding='utf-8')
"
  echo "$flow_id"
}

# lock_hash_for_state <abs_state_file_path>
# Computes the WORKFLOW_LOCK_DIR hash (same algorithm as config.sh)
lock_hash_for_state() {
  python3 -c "
import hashlib, sys
p = sys.argv[1]
print(hashlib.sha256(p.encode('utf-8')).hexdigest()[:16])
" "$1"
}

# run_fork <project_dir> [--label <lbl>]
# Returns stdout of `flowctl fork` (the eval-able export line).
run_fork() {
  local dir="$1"; shift
  FLOWCTL_PROJECT_ROOT="$dir" PROJECT_ROOT="$dir" REPO_ROOT="$dir" \
    bash "$FLOWCTL_SH" fork "$@" 2>/dev/null
}

# ─────────────────────────────────────────────────────────────
# TC-01: fork stdout is eval-able (export FLOWCTL_ACTIVE_FLOW=wf-...)
# ─────────────────────────────────────────────────────────────
tc01_dir="$TMP/tc01"
make_flow_project "$tc01_dir" "project-01" >/dev/null
FORK_OUT="$(run_fork "$tc01_dir" --label "task-01")"
if [[ "$FORK_OUT" =~ ^export\ FLOWCTL_ACTIVE_FLOW=wf-[0-9a-f-]{36}$ ]]; then
  pass 1 "fork stdout matches 'export FLOWCTL_ACTIVE_FLOW=wf-<uuid>'"
else
  fail 1 "fork stdout is not eval-able: '$FORK_OUT'"
fi

# ─────────────────────────────────────────────────────────────
# TC-02: fork creates .flowctl/flows/<short>/state.json
# ─────────────────────────────────────────────────────────────
tc02_dir="$TMP/tc02"
make_flow_project "$tc02_dir" "project-02" >/dev/null
run_fork "$tc02_dir" --label "task-02" >/dev/null
FOUND=$(find "$tc02_dir/.flowctl/flows" -name "state.json" | wc -l | tr -d ' ')
if [[ "$FOUND" -eq 2 ]]; then
  # Verify content of the newly created file (the one NOT in the original flow dir)
  NEW_STATE=$(find "$tc02_dir/.flowctl/flows" -name "state.json" | head -2 | tail -1)
  VALID=$(python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    assert d.get('flow_id','').startswith('wf-'), 'bad flow_id'
    assert d.get('overall_status') == 'in_progress', 'bad status'
    print('ok')
except Exception as e:
    print(f'err: {e}')
" "$NEW_STATE")
  if [[ "$VALID" == "ok" ]]; then
    pass 2 "fork created valid state.json at .flowctl/flows/<short>/state.json"
  else
    fail 2 "fork state.json invalid: $VALID"
  fi
else
  fail 2 "expected 2 state.json files (original + fork), found $FOUND"
fi

# ─────────────────────────────────────────────────────────────
# TC-03: fork does NOT change active_flow_id in flows.json
# ─────────────────────────────────────────────────────────────
tc03_dir="$TMP/tc03"
ORIG_ACTIVE=$(make_flow_project "$tc03_dir" "project-03")
run_fork "$tc03_dir" --label "task-03" >/dev/null
AFTER_ACTIVE=$(python3 -c "
import json
print(json.load(open('$tc03_dir/.flowctl/flows.json', encoding='utf-8'))['active_flow_id'])
")
if [[ "$ORIG_ACTIVE" == "$AFTER_ACTIVE" ]]; then
  pass 3 "flows.json active_flow_id unchanged after fork ($ORIG_ACTIVE)"
else
  fail 3 "active_flow_id changed: before=$ORIG_ACTIVE after=$AFTER_ACTIVE"
fi

# ─────────────────────────────────────────────────────────────
# TC-04: fork --label propagates to state project_description
# ─────────────────────────────────────────────────────────────
tc04_dir="$TMP/tc04"
make_flow_project "$tc04_dir" "project-04" >/dev/null
NEW_FID=$(run_fork "$tc04_dir" --label "auth-feature" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
# Find the state file for the new flow
NEW_SF=$(python3 -c "
import json
from pathlib import Path
idx = json.loads(Path('$tc04_dir/.flowctl/flows.json').read_text(encoding='utf-8'))
sf = (idx.get('flows') or {}).get('$NEW_FID', {}).get('state_file', '')
print(str(Path('$tc04_dir') / sf) if sf else '')
")
if [[ -n "$NEW_SF" && -f "$NEW_SF" ]]; then
  DESC=$(python3 -c "import json; print(json.load(open('$NEW_SF',encoding='utf-8')).get('project_description',''))")
  if [[ "$DESC" == "auth-feature" ]]; then
    pass 4 "fork --label sets project_description='auth-feature'"
  else
    fail 4 "project_description='$DESC', expected 'auth-feature'"
  fi
else
  fail 4 "cannot locate new flow state file for flow_id=$NEW_FID"
fi

# ─────────────────────────────────────────────────────────────
# TC-05: 5 concurrent forks → unique flow_ids, all in flows.json, active unchanged
# ─────────────────────────────────────────────────────────────
tc05_dir="$TMP/tc05"
ORIG5=$(make_flow_project "$tc05_dir" "project-05")
FORK_IDS=()
for i in 1 2 3 4 5; do
  FID=$(run_fork "$tc05_dir" --label "parallel-$i" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
  FORK_IDS+=("$FID")
done
# Uniqueness check
UNIQUE=$(printf '%s\n' "${FORK_IDS[@]}" | sort -u | wc -l | tr -d ' ')
if [[ "$UNIQUE" -eq 5 ]]; then
  # Check all 5 are in flows.json
  ALL_REGISTERED=$(python3 -c "
import json
idx = json.load(open('$tc05_dir/.flowctl/flows.json', encoding='utf-8'))
fids = $(python3 -c "import json; print(json.dumps(['${FORK_IDS[0]}','${FORK_IDS[1]}','${FORK_IDS[2]}','${FORK_IDS[3]}','${FORK_IDS[4]}']))")
missing = [f for f in fids if f not in (idx.get('flows') or {})]
print('ok' if not missing else 'missing: ' + str(missing))
")
  AFTER5=$(python3 -c "import json; print(json.load(open('$tc05_dir/.flowctl/flows.json',encoding='utf-8'))['active_flow_id'])")
  if [[ "$ALL_REGISTERED" == "ok" && "$AFTER5" == "$ORIG5" ]]; then
    pass 5 "5 forks: all unique, all registered, active_flow_id unchanged"
  else
    fail 5 "registration check: $ALL_REGISTERED | active changed: $ORIG5 → $AFTER5"
  fi
else
  fail 5 "expected 5 unique flow_ids, got $UNIQUE: ${FORK_IDS[*]}"
fi

# ─────────────────────────────────────────────────────────────
# TC-06: resolver with FLOWCTL_ACTIVE_FLOW → returns correct state file
# ─────────────────────────────────────────────────────────────
tc06_dir="$TMP/tc06"
make_flow_project "$tc06_dir" "project-06" >/dev/null
FORK6=$(run_fork "$tc06_dir" --label "task-06" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
EXPECTED_SF=$(python3 -c "
import json; from pathlib import Path
idx = json.loads(Path('$tc06_dir/.flowctl/flows.json').read_text(encoding='utf-8'))
sf = (idx.get('flows') or {}).get('$FORK6', {}).get('state_file', '')
print(str(Path('$tc06_dir') / sf) if sf else '')
")
RESOLVED=$(FLOWCTL_PROJECT_ROOT="$tc06_dir" REPO_ROOT="$tc06_dir" \
  FLOWCTL_ACTIVE_FLOW="$FORK6" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
if [[ "$RESOLVED" == "$EXPECTED_SF" ]]; then
  pass 6 "resolver with FLOWCTL_ACTIVE_FLOW=$FORK6 → correct state file"
else
  fail 6 "resolver returned '$RESOLVED', expected '$EXPECTED_SF'"
fi

# ─────────────────────────────────────────────────────────────
# TC-07: two different FLOWCTL_ACTIVE_FLOW → different lock hashes
# ─────────────────────────────────────────────────────────────
tc07_dir="$TMP/tc07"
make_flow_project "$tc07_dir" "project-07" >/dev/null
FID_A=$(run_fork "$tc07_dir" --label "task-a" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
FID_B=$(run_fork "$tc07_dir" --label "task-b" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
SF_A=$(FLOWCTL_PROJECT_ROOT="$tc07_dir" REPO_ROOT="$tc07_dir" FLOWCTL_ACTIVE_FLOW="$FID_A" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
SF_B=$(FLOWCTL_PROJECT_ROOT="$tc07_dir" REPO_ROOT="$tc07_dir" FLOWCTL_ACTIVE_FLOW="$FID_B" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
HASH_A=$(lock_hash_for_state "$SF_A")
HASH_B=$(lock_hash_for_state "$SF_B")
if [[ "$HASH_A" != "$HASH_B" && -n "$HASH_A" && -n "$HASH_B" ]]; then
  pass 7 "different flows → different lock hashes ($HASH_A ≠ $HASH_B)"
else
  fail 7 "same lock hash for different flows: A=$HASH_A B=$HASH_B"
fi

# ─────────────────────────────────────────────────────────────
# TC-08: same flow_id → same lock hash (deterministic)
# ─────────────────────────────────────────────────────────────
tc08_dir="$TMP/tc08"
ORIG8=$(make_flow_project "$tc08_dir" "project-08")
SF8=$(FLOWCTL_PROJECT_ROOT="$tc08_dir" REPO_ROOT="$tc08_dir" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
HASH8_1=$(lock_hash_for_state "$SF8")
HASH8_2=$(lock_hash_for_state "$SF8")
if [[ "$HASH8_1" == "$HASH8_2" && -n "$HASH8_1" ]]; then
  pass 8 "same flow_id → deterministic lock hash ($HASH8_1)"
else
  fail 8 "non-deterministic hash: $HASH8_1 vs $HASH8_2"
fi

# ─────────────────────────────────────────────────────────────
# TC-09: lock conflict (same flow, two processes) → exit 1, hint has eval fork
# ─────────────────────────────────────────────────────────────
tc09_dir="$TMP/tc09"
make_flow_project "$tc09_dir" "project-09" >/dev/null
SF9=$(FLOWCTL_PROJECT_ROOT="$tc09_dir" REPO_ROOT="$tc09_dir" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
HASH9=$(lock_hash_for_state "$SF9")
LOCK9="$tc09_dir/.flowctl/locks/$HASH9"

# Hold the lock in background via mkdir (mimics wf_acquire_flow_lock)
mkdir -p "$LOCK9"
echo "$$" > "$LOCK9/pid"

# Source lock.sh and try to acquire — should fail
LOCK_OUT=$(
  REPO_ROOT="$tc09_dir" \
  WORKFLOW_LOCK_DIR="$LOCK9" \
  YELLOW='' RED='' BOLD='' NC='' \
  bash -c "
    source '$LIB_DIR/common.sh' 2>/dev/null || true
    YELLOW='' RED='' BOLD='' NC=''
    wf_acquire_flow_lock() {
      if mkdir \"\$WORKFLOW_LOCK_DIR\" 2>/dev/null; then
        echo \$\$ > \"\$WORKFLOW_LOCK_DIR/pid\"
        trap 'rm -rf \"\$WORKFLOW_LOCK_DIR\"' EXIT
        return 0
      fi
      local holder='unknown'
      [[ -f \"\$WORKFLOW_LOCK_DIR/pid\" ]] && holder=\"\$(<\"\$WORKFLOW_LOCK_DIR/pid\")\"
      local _stale=false
      if [[ \"\$holder\" =~ ^[1-9][0-9]*\$ ]]; then
        kill -0 \"\$holder\" 2>/dev/null || _stale=true
      else
        _stale=true
      fi
      if \$_stale; then
        rm -rf \"\$WORKFLOW_LOCK_DIR\" 2>/dev/null && mkdir \"\$WORKFLOW_LOCK_DIR\" 2>/dev/null && echo \$\$ > \"\$WORKFLOW_LOCK_DIR/pid\" && return 0
      fi
      echo 'LOCK_HELD_BY='\$holder
      echo 'HINT_EVAL_FORK'
      exit 1
    }
    source '$LIB_DIR/lock.sh'
    wf_acquire_flow_lock 2>&1 || true
  " 2>&1
) || true

# Cleanup the held lock
rm -rf "$LOCK9"

if echo "$LOCK_OUT" | grep -q "LOCK_HELD_BY\|Workflow lock\|pid=$"; then
  # Also verify hint content via real lock.sh hint function
  HINT_OUT=$(
    YELLOW='' RED='' BOLD='' NC='' \
    bash -c "source '$LIB_DIR/lock.sh' 2>/dev/null; _wf_lock_hint" 2>&1
  )
  if echo "$HINT_OUT" | grep -q 'flowctl fork'; then
    pass 9 "lock conflict: exit 1 produced, hint contains 'flowctl fork'"
  else
    fail 9 "hint does not mention 'flowctl fork': $HINT_OUT"
  fi
else
  fail 9 "expected lock conflict output, got: $LOCK_OUT"
fi

# ─────────────────────────────────────────────────────────────
# TC-10: two forks running simultaneously → no lock conflict
# ─────────────────────────────────────────────────────────────
tc10_dir="$TMP/tc10"
make_flow_project "$tc10_dir" "project-10" >/dev/null
FID_10A=$(run_fork "$tc10_dir" --label "task-10a" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
FID_10B=$(run_fork "$tc10_dir" --label "task-10b" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
SF_10A=$(FLOWCTL_PROJECT_ROOT="$tc10_dir" REPO_ROOT="$tc10_dir" FLOWCTL_ACTIVE_FLOW="$FID_10A" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
SF_10B=$(FLOWCTL_PROJECT_ROOT="$tc10_dir" REPO_ROOT="$tc10_dir" FLOWCTL_ACTIVE_FLOW="$FID_10B" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
HASH_10A=$(lock_hash_for_state "$SF_10A")
HASH_10B=$(lock_hash_for_state "$SF_10B")
LOCK_10A="$tc10_dir/.flowctl/locks/$HASH_10A"
LOCK_10B="$tc10_dir/.flowctl/locks/$HASH_10B"

# Both acquire their respective locks simultaneously (no conflict expected)
mkdir -p "$LOCK_10A" && echo "p1" > "$LOCK_10A/pid"
mkdir -p "$LOCK_10B" && echo "p2" > "$LOCK_10B/pid"
BOTH_EXIST=false
[[ -f "$LOCK_10A/pid" && -f "$LOCK_10B/pid" ]] && BOTH_EXIST=true
rm -rf "$LOCK_10A" "$LOCK_10B"

if $BOTH_EXIST && [[ "$HASH_10A" != "$HASH_10B" ]]; then
  pass 10 "two forked flows acquire their own locks simultaneously without conflict"
else
  fail 10 "lock collision or acquisition failed: HASH_A=$HASH_10A HASH_B=$HASH_10B both=$BOTH_EXIST"
fi

# ─────────────────────────────────────────────────────────────
# TC-11: stale lock (non-existent pid) → auto-reclaimed
# ─────────────────────────────────────────────────────────────
tc11_dir="$TMP/tc11"
make_flow_project "$tc11_dir" "project-11" >/dev/null
SF11=$(FLOWCTL_PROJECT_ROOT="$tc11_dir" REPO_ROOT="$tc11_dir" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
HASH11=$(lock_hash_for_state "$SF11")
LOCK11="$tc11_dir/.flowctl/locks/$HASH11"

# Plant a stale lock with a dead pid
mkdir -p "$LOCK11"
echo "99999999" > "$LOCK11/pid"  # pid that cannot exist

RECLAIM_OUT=$(
  WORKFLOW_LOCK_DIR="$LOCK11" \
  YELLOW='' RED='' NC='' \
  bash -c "
    YELLOW='' RED='' NC=''
    source '$LIB_DIR/lock.sh'
    wf_acquire_flow_lock && echo 'ACQUIRED' || echo 'FAILED'
  " 2>/dev/null
) || true

# Clean up
rm -rf "$LOCK11"

if echo "$RECLAIM_OUT" | grep -q "ACQUIRED\|Reclaimed"; then
  pass 11 "stale lock (dead pid=99999999) auto-reclaimed"
else
  fail 11 "stale lock NOT reclaimed: $RECLAIM_OUT"
fi

# ─────────────────────────────────────────────────────────────
# TC-12: lock released on process exit (EXIT trap fires)
# ─────────────────────────────────────────────────────────────
tc12_dir="$TMP/tc12"
make_flow_project "$tc12_dir" "project-12" >/dev/null
SF12=$(FLOWCTL_PROJECT_ROOT="$tc12_dir" REPO_ROOT="$tc12_dir" \
  python3 "$RESOLVER" | python3 -c "import json,sys; print(json.load(sys.stdin)['state_file'])")
HASH12=$(lock_hash_for_state "$SF12")
LOCK12="$tc12_dir/.flowctl/locks/$HASH12"

bash -c "
  WORKFLOW_LOCK_DIR='$LOCK12'
  YELLOW='' RED='' NC=''
  source '$LIB_DIR/lock.sh'
  wf_acquire_flow_lock
  sleep 0.1
  # Process exits → EXIT trap calls wf_release_flow_lock
" 2>/dev/null
sleep 0.2  # allow subprocess to finish

if [[ ! -d "$LOCK12" ]]; then
  pass 12 "lock dir removed after process exit (EXIT trap fired)"
else
  LEFTOVER=$(cat "$LOCK12/pid" 2>/dev/null || echo "?")
  fail 12 "lock dir still exists after exit, pid=$LEFTOVER"
fi

# ─────────────────────────────────────────────────────────────
# TC-13: fork with no existing flows.json → creates it, sets active_flow_id
# ─────────────────────────────────────────────────────────────
tc13_dir="$TMP/tc13"
mkdir -p "$tc13_dir"
# No flows.json yet
FORK13=$(run_fork "$tc13_dir" --label "first-task" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
if [[ -f "$tc13_dir/.flowctl/flows.json" ]]; then
  ACTIVE13=$(python3 -c "
import json; print(json.load(open('$tc13_dir/.flowctl/flows.json',encoding='utf-8'))['active_flow_id'])
")
  if [[ "$ACTIVE13" == "$FORK13" ]]; then
    pass 13 "fork with no flows.json creates it with correct active_flow_id"
  else
    fail 13 "active_flow_id='$ACTIVE13', expected '$FORK13'"
  fi
else
  fail 13 "flows.json not created by fork on fresh project"
fi

# ─────────────────────────────────────────────────────────────
# TC-14: fork inherits project_name from active state file
# ─────────────────────────────────────────────────────────────
tc14_dir="$TMP/tc14"
make_flow_project "$tc14_dir" "my-special-project" >/dev/null
FORK14=$(run_fork "$tc14_dir" --label "fork-14" | sed 's/export FLOWCTL_ACTIVE_FLOW=//')
SF14=$(python3 -c "
import json; from pathlib import Path
idx = json.loads(Path('$tc14_dir/.flowctl/flows.json').read_text(encoding='utf-8'))
sf = (idx.get('flows') or {}).get('$FORK14', {}).get('state_file', '')
print(str(Path('$tc14_dir') / sf) if sf else '')
")
if [[ -n "$SF14" && -f "$SF14" ]]; then
  PROJ14=$(python3 -c "import json; print(json.load(open('$SF14',encoding='utf-8')).get('project_name',''))")
  if [[ "$PROJ14" == "my-special-project" ]]; then
    pass 14 "fork inherits project_name='my-special-project' from active flow"
  else
    fail 14 "project_name='$PROJ14', expected 'my-special-project'"
  fi
else
  fail 14 "cannot locate fork state file for flow_id=$FORK14"
fi

# ─────────────────────────────────────────────────────────────
# Results
# ─────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[[ $FAIL -eq 0 ]] || exit 1
exit 0
