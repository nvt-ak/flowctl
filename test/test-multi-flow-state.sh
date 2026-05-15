#!/usr/bin/env bash
# Regression: resolve_state_path honors FLOWCTL_STATE_FILE and .flowctl/flows.json active flow.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOLVER="$ROOT/scripts/workflow/lib/resolve_state_path.py"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

[[ -f "$RESOLVER" ]] || fail "missing $RESOLVER"

mkdir -p "$TMP/repo"
printf '%s\n' '{"flow_id":"wf-aaaaaaaa-bbbb-cccc-dddddddddddd","project_name":"P","current_step":1}' > "$TMP/a.json"
printf '%s\n' '{"flow_id":"wf-11111111-2222-3333-444444444444","project_name":"P","current_step":9}' > "$TMP/b.json"

# Relative FLOWCTL_STATE_FILE from repo root
OUT="$(cd "$TMP/repo" && FLOWCTL_PROJECT_ROOT="$TMP/repo" REPO_ROOT="$TMP/repo" FLOWCTL_STATE_FILE="../a.json" python3 "$RESOLVER")"
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['source']=='env_state_file', d; assert d['state_file'].endswith('a.json'), d" <<<"$OUT" \
  || fail "relative FLOWCTL_STATE_FILE"

# Absolute FLOWCTL_STATE_FILE
OUT="$(FLOWCTL_PROJECT_ROOT="$TMP/repo" REPO_ROOT="$TMP/repo" FLOWCTL_STATE_FILE="$TMP/b.json" python3 "$RESOLVER")"
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['source']=='env_state_file'; assert d['state_file'].endswith('b.json')" <<<"$OUT" \
  || fail "absolute FLOWCTL_STATE_FILE"

# Uninitialized repo: no flows.json and no legacy root file → not_initialized, empty state_file
OUT="$(FLOWCTL_PROJECT_ROOT="$TMP/repo" REPO_ROOT="$TMP/repo" python3 "$RESOLVER")"
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['source']=='not_initialized', d; assert d['state_file']==''" <<<"$OUT" \
  || fail "not_initialized when no flows index and no legacy state"

# flows.json active_flow_id → state_file
mkdir -p "$TMP/repo/.flowctl/flows/zz"
cp "$TMP/a.json" "$TMP/repo/.flowctl/flows/zz/state.json"
cat > "$TMP/repo/.flowctl/flows.json" <<'JSON'
{
  "version": 1,
  "active_flow_id": "wf-aaaaaaaa-bbbb-cccc-dddddddddddd",
  "flows": {
    "wf-aaaaaaaa-bbbb-cccc-dddddddddddd": {
      "state_file": ".flowctl/flows/zz/state.json",
      "label": "test"
    }
  }
}
JSON
OUT="$(FLOWCTL_PROJECT_ROOT="$TMP/repo" REPO_ROOT="$TMP/repo" python3 "$RESOLVER")"
python3 -c "import json,sys; d=json.load(sys.stdin); assert d['source']=='flows_json', d; assert 'zz' in d['state_file'] and d['state_file'].endswith('state.json'), d" <<<"$OUT" \
  || fail "flows.json active resolution"

# Two terminals: different env → different resolved files (no cross-write in this test)
A="$(FLOWCTL_PROJECT_ROOT="$TMP/repo" FLOWCTL_STATE_FILE="$TMP/a.json" python3 "$RESOLVER" | python3 -c "import json,sys;print(json.load(sys.stdin)['state_file'])")"
B="$(FLOWCTL_PROJECT_ROOT="$TMP/repo" FLOWCTL_STATE_FILE="$TMP/b.json" python3 "$RESOLVER" | python3 -c "import json,sys;print(json.load(sys.stdin)['state_file'])")"
[[ "$A" != "$B" ]] || fail "two env files must resolve to distinct paths"
python3 -c "import json; assert json.load(open('$A'))['current_step']==1"
python3 -c "import json; assert json.load(open('$B'))['current_step']==9"

pass "multi-flow state resolution (env + flows.json + isolation)"
exit 0
