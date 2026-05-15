#!/usr/bin/env bash
# test-workflow-fixes.sh — regression tests for specific bug fixes
# Each test targets a previously-broken behaviour.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$REPO_ROOT/scripts/flowctl.sh"
# shellcheck disable=SC1091
source "$REPO_ROOT/test/helpers/flowctl_state_path.sh"
STAMP="$(date '+%Y%m%d-%H%M%S')"
TEST_DIR="$(mktemp -d)"
PASS=0
FAIL=0

cleanup() { rm -rf "$TEST_DIR"; }
trap cleanup EXIT

log()  { echo "$1"; }
pass() { log "  PASS: $1"; PASS=$((PASS+1)); }
fail() { log "  FAIL: $1"; FAIL=$((FAIL+1)); }

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if echo "$haystack" | grep -qF "$needle"; then pass "$label"
  else fail "$label — expected: '$needle'"; fi
}

assert_not_contains() {
  local haystack="$1" needle="$2" label="$3"
  if echo "$haystack" | grep -qF "$needle"; then fail "$label — should NOT contain: '$needle'"
  else pass "$label"; fi
}

assert_equals() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$label"
  else fail "$label — expected='$expected' actual='$actual'"; fi
}

expect_success() {
  local title="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "$title"
  else fail "$title (expected success, got failure)"; fi
}

expect_failure() {
  local title="$1"; shift
  if "$@" >/dev/null 2>&1; then fail "$title (expected failure, got success)"
  else pass "$title"; fi
}

# ── Setup: isolated project dir per test ────────────────────────────────────

new_project() {
  local name="${1:-FixTest}"
  local dir
  dir="$(mktemp -d "$TEST_DIR/proj-XXXXXX")"
  FLOWCTL_SKIP_SETUP=1 PROJECT_ROOT="$dir" \
    bash "$WORKFLOW" init --no-setup --project "$name" >/dev/null 2>&1
  echo "$dir"
}

# Compute DISPATCH_BASE for a given project dir (mirrors config.sh logic)
project_dispatch_base() {
  local proj_dir="$1"
  local state fl_short
  state="$(flowctl_resolve_state_for_project "$proj_dir")"
  if [[ -z "$state" || ! -f "$state" ]]; then
    echo "$proj_dir/workflows/dispatch"
    return
  fi
  fl_short="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1],encoding="utf-8")); fid=d.get("flow_id") or ""; print(fid[3:11] if fid.startswith("wf-") and len(fid)>=11 else "")' "$state" 2>/dev/null || echo "")"
  if [[ -n "$fl_short" ]]; then
    echo "$proj_dir/workflows/$fl_short/dispatch"
  else
    echo "$proj_dir/workflows/dispatch"
  fi
}

# ============================================================
# FIX 1: gate.sh — state_report_deliverables fallback
# Bug: used endswith("-report.md") but collect writes
#      "path/to/foo-report.md — Worker report" which never matched.
# ============================================================
log ""
log "=== FIX 1: Gate state-fallback counts report deliverables correctly ==="

_proj=$(new_project "GateFallbackTest")
_state="$(flowctl_resolve_state_for_project "$_proj")"
_reports="$(project_dispatch_base "$_proj")/step-1/reports"

# Advance to in_progress
PROJECT_ROOT="$_proj" bash "$WORKFLOW" start >/dev/null 2>&1

# Write a report file
mkdir -p "$_reports"
cat > "$_reports/pm-report.md" <<'EOF'
# Worker Report — @pm — Step 1
## SUMMARY
Test fix for gate fallback.
## DELIVERABLES
- DELIVERABLE: docs/test.md — test deliverable
## DECISIONS
- DECISION: Use fallback path for gate check
## BLOCKERS
- BLOCKER: NONE
EOF

# Run collect — adds "path/to/pm-report.md — Worker report" to state
PROJECT_ROOT="$_proj" bash "$WORKFLOW" collect >/dev/null 2>&1

# Verify state has deliverable with "-report.md" in it (string format collect uses)
_deliv=$(python3 -c "
import json
from pathlib import Path
s = json.loads(Path('$_state').read_text())
d = s['steps']['1'].get('deliverables', [])
matches = [x for x in d if isinstance(x, str) and '-report.md' in x]
print(len(matches))
")
assert_equals "$_deliv" "1" "collect adds string deliverable with -report.md"

# Gate check should now pass (1 report, 1 deliverable)
_gate_out=$(PROJECT_ROOT="$_proj" bash "$WORKFLOW" gate-check 2>&1 || true)
assert_contains "$_gate_out" "QA Gate" "gate-check runs after collect"

# Delete the report from disk — fallback to state must still count it
rm -f "$_reports/pm-report.md"
_gate_out2=$(PROJECT_ROOT="$_proj" bash "$WORKFLOW" gate-check 2>&1 || true)
assert_not_contains "$_gate_out2" "Need >= 1 worker report(s), found 0" \
  "gate uses state fallback when reports missing from disk"

# ============================================================
# FIX 2: collect — no longer hard-exits when reports dir missing
# Bug: exit 1 when workflows/dispatch/step-N/reports/ didn't exist
#      blocked MICRO flow from ever running collect.
# ============================================================
log ""
log "=== FIX 2: collect graceful when reports dir missing (MICRO flow) ==="

_proj2=$(new_project "CollectMicroTest")
PROJECT_ROOT="$_proj2" bash "$WORKFLOW" start >/dev/null 2>&1

_proj2_dispatch="$(project_dispatch_base "$_proj2")"
# No dispatch ran — reports dir does NOT exist
[[ ! -d "$_proj2_dispatch/step-1/reports" ]] && \
  pass "reports dir confirmed missing before test" || \
  fail "reports dir should not exist yet"

# collect should NOT exit 1 — it should create dir and return NO_REPORTS
_collect_rc=0
_collect_out=$(PROJECT_ROOT="$_proj2" bash "$WORKFLOW" collect 2>&1) || _collect_rc=$?

assert_equals "$_collect_rc" "0" "collect exits 0 even when reports dir missing"
assert_contains "$_collect_out" "worker report" "collect reports gracefully when no reports found"
[[ -d "$_proj2_dispatch/step-1/reports" ]] && \
  pass "collect created reports dir" || \
  fail "collect should create reports dir"

# ============================================================
# FIX 3: MICRO flow — collect + gate + approve sequence works
# Bug: MICRO flow approved directly without collect → 0 deliverables → gate fail
# ============================================================
log ""
log "=== FIX 3: MICRO flow — write report → collect → gate → approve ==="

_proj3=$(new_project "MicroFlowTest")
_reports3="$(project_dispatch_base "$_proj3")/step-1/reports"
PROJECT_ROOT="$_proj3" bash "$WORKFLOW" start >/dev/null 2>&1

# PM writes self-report (as instructed by new /flowctl command)
mkdir -p "$_reports3"
cat > "$_reports3/pm-report.md" <<'EOF'
# Worker Report — @pm — Step 1
## SUMMARY
Micro task: analysed requirements.
## DELIVERABLES
- DELIVERABLE: docs/requirements.md — requirements document
## DECISIONS
- DECISION: Scope limited to core features only
## BLOCKERS
- BLOCKER: NONE
EOF

# Must create the deliverable file too (gate verifies existence for DELIVERABLE: lines)
mkdir -p "$_proj3/docs"
echo "# Requirements" > "$_proj3/docs/requirements.md"

# collect
_c_out=$(PROJECT_ROOT="$_proj3" bash "$WORKFLOW" collect 2>&1)
assert_contains "$_c_out" "Collect hoàn tất" "collect succeeds with pm-report"

# gate-check
_g_out=$(PROJECT_ROOT="$_proj3" bash "$WORKFLOW" gate-check 2>&1 || true)
assert_not_contains "$_g_out" "GATE_FAIL" "gate passes after MICRO collect"

# approve
_a_rc=0
PROJECT_ROOT="$_proj3" bash "$WORKFLOW" approve --by "PM" --note "micro task: requirements done" \
  >/dev/null 2>&1 || _a_rc=$?
assert_equals "$_a_rc" "0" "approve succeeds after MICRO collect+gate"

# Step should advance to 2
_step=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1],encoding='utf-8'))['current_step'])" "$(flowctl_resolve_state_for_project "$_proj3")")
assert_equals "$_step" "2" "MICRO approve advances to step 2"

# ============================================================
# FIX 4: flowctl init dedup — re-init reuses existing ~/.flowctl dir
# Bug: each init created new slug-short dir in ~/.flowctl/projects/
#      even when same project (same flow_id).
# ============================================================
log ""
log "=== FIX 4: re-init reuses existing ~/.flowctl/projects dir ==="

_proj4=$(new_project "DedupTest")
_home4="$(mktemp -d "$TEST_DIR/home-XXXXXX")"

# First init with custom FLOWCTL_HOME
FLOWCTL_HOME="$_home4" FLOWCTL_SKIP_SETUP=1 PROJECT_ROOT="$_proj4" \
  bash "$WORKFLOW" init --no-setup --project "DedupTest" >/dev/null 2>&1

_dirs_after_first=$(ls "$_home4/projects/" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "$_dirs_after_first" "1" "first init creates exactly 1 project dir"
_first_dir=$(ls "$_home4/projects/")

# Re-init same project (simulates user running flowctl init again)
FLOWCTL_HOME="$_home4" FLOWCTL_SKIP_SETUP=1 PROJECT_ROOT="$_proj4" \
  bash "$WORKFLOW" init --no-setup --project "DedupTest Renamed" >/dev/null 2>&1

_dirs_after_second=$(ls "$_home4/projects/" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "$_dirs_after_second" "1" "re-init does NOT create duplicate dir"

_second_dir=$(ls "$_home4/projects/")
assert_equals "$_first_dir" "$_second_dir" "re-init reuses the same dir (dedup by flow_id)"

# --overwrite must also reuse (not create a third dir)
FLOWCTL_HOME="$_home4" FLOWCTL_SKIP_SETUP=1 PROJECT_ROOT="$_proj4" \
  bash "$WORKFLOW" init --overwrite --no-setup --project "DedupTest Overwritten" >/dev/null 2>&1

_dirs_after_overwrite=$(ls "$_home4/projects/" 2>/dev/null | wc -l | tr -d ' ')
assert_equals "$_dirs_after_overwrite" "1" "--overwrite does NOT create duplicate dir"

_overwrite_dir=$(ls "$_home4/projects/")
assert_equals "$_first_dir" "$_overwrite_dir" "--overwrite reuses the same dir"

# ============================================================
# FIX 5: flowctl start required — step must be in_progress for gate
# Bug: step started as pending after init, gate rejected with status error
# ============================================================
log ""
log "=== FIX 5: gate rejects approve when step is still pending ==="

_proj5=$(new_project "StartRequiredTest")

# Don't run start — step remains pending
_step_status=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1],encoding='utf-8'))['steps']['1']['status'])" "$(flowctl_resolve_state_for_project "$_proj5")")
assert_equals "$_step_status" "pending" "step is pending after init"

# gate-check should fail with status error
_g_out=$(PROJECT_ROOT="$_proj5" bash "$WORKFLOW" gate-check 2>&1 || true)
assert_contains "$_g_out" "GATE_FAIL" "gate fails when step is pending"

# After flowctl start, step moves to in_progress
PROJECT_ROOT="$_proj5" bash "$WORKFLOW" start >/dev/null 2>&1
_step_status2=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1],encoding='utf-8'))['steps']['1']['status'])" "$(flowctl_resolve_state_for_project "$_proj5")")
assert_equals "$_step_status2" "in_progress" "flowctl start moves step to in_progress"

# ============================================================
# FIX 6: package.json includes .cursor scaffold dirs
# Bug: .cursor/agents|commands|rules|skills + .cursorrules not in files array
#      so npm publish excluded them — flowctl init couldn't scaffold them
# ============================================================
log ""
log "=== FIX 6: package.json files includes .cursor scaffold dirs ==="

python3 - "$REPO_ROOT/package.json" <<'PY'
import json, sys
from pathlib import Path

pkg = json.loads(Path(sys.argv[1]).read_text())
declared = set(pkg.get("files", []))

required = [
    ".cursor/agents",
    ".cursor/commands",
    ".cursor/rules",
    ".cursor/skills",
    ".cursorrules",
]
missing_pkg  = [p for p in required if p not in declared]
missing_disk = [p for p in required if not (Path(sys.argv[1]).parent / p).exists()]

ok = True
for p in required:
    in_pkg  = p in declared
    on_disk = (Path(sys.argv[1]).parent / p).exists()
    print(f"  {'PASS' if in_pkg and on_disk else 'FAIL'}: {p} (pkg={in_pkg}, disk={on_disk})")
    if not (in_pkg and on_disk):
        ok = False

sys.exit(0 if ok else 1)
PY
[[ $? -eq 0 ]] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

# ============================================================
# FIX 7: config.sh — _fl_short must be bound under set -u when flow_id empty
# Bug: _fl_short was only set inside `if [[ -n "$_fl_id" ]]`, so pre-init
#      projects hit `_fl_short` unbound at DISPATCH_BASE resolution →
#      "line 135: _fl_short: unbound variable" with set -u (e.g. setup.sh).
# ============================================================
log ""
log "=== FIX 7: config.sh sources cleanly with set -u (empty vs set flow_id) ==="

_cfg_proj="$(mktemp -d "$TEST_DIR/cfg-nounset-XXXXXX")"
_cfg_home="$(mktemp -d "$TEST_DIR/cfg-home-XXXXXX")"
mkdir -p "$_cfg_proj"
python3 -c "import json, pathlib; pathlib.Path(r'$_cfg_proj/flowctl-state.json').write_text(json.dumps({'flow_id':'','project_name':'NounsetPreInit','current_step':1,'overall_status':'pending'}), encoding='utf-8')"

_cfg_nounset_empty() {
  (
    set -euo pipefail
    unset FLOWCTL_STATE_FILE FLOWCTL_ACTIVE_FLOW || true
    export PROJECT_ROOT="$1"
    export FLOWCTL_HOME="$2"
    # shellcheck disable=SC1091
    source "$REPO_ROOT/scripts/workflow/lib/config.sh"
    [[ "$DISPATCH_BASE" == "$PROJECT_ROOT/workflows/dispatch" ]]
    [[ "$GATE_REPORTS_DIR" == "$PROJECT_ROOT/workflows/gates/reports" ]]
    [[ "$RETRO_DIR" == "$PROJECT_ROOT/workflows/retro" ]]
  )
}

if _cfg_nounset_empty "$_cfg_proj" "$_cfg_home"; then
  pass "config.sh + set -u: empty flow_id uses legacy DISPATCH_* paths"
else
  fail "config.sh + set -u: empty flow_id (expected legacy paths, no unbound _fl_short)"
fi

_cfg_proj2="$(mktemp -d "$TEST_DIR/cfg-nounset2-XXXXXX")"
_cfg_home2="$(mktemp -d "$TEST_DIR/cfg-home2-XXXXXX")"
mkdir -p "$_cfg_proj2"
python3 -c "import json, pathlib; pathlib.Path(r'$_cfg_proj2/flowctl-state.json').write_text(json.dumps({'flow_id':'wf-abcdef12-0000-0000-0000-000000000001','project_name':'NounsetWithFlow','current_step':1,'overall_status':'pending'}), encoding='utf-8')"

_cfg_nounset_with_flow() {
  (
    set -euo pipefail
    unset FLOWCTL_STATE_FILE FLOWCTL_ACTIVE_FLOW || true
    export PROJECT_ROOT="$1"
    export FLOWCTL_HOME="$2"
    # shellcheck disable=SC1091
    source "$REPO_ROOT/scripts/workflow/lib/config.sh"
    [[ "$DISPATCH_BASE" == "$PROJECT_ROOT/workflows/abcdef12/dispatch" ]]
  )
}

if _cfg_nounset_with_flow "$_cfg_proj2" "$_cfg_home2"; then
  pass "config.sh + set -u: non-empty flow_id uses per-flow DISPATCH_BASE"
else
  fail "config.sh + set -u: per-flow DISPATCH_BASE mismatch"
fi

# ============================================================
# Summary
# ============================================================
log ""
log "============================================"
log "Results: $PASS passed, $FAIL failed"
log "============================================"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
