#!/usr/bin/env bash
# test-complexity-war-room.sh — complexity tiers, War Room gate (threshold 4), cursor-dispatch flags
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$REPO_ROOT/test/helpers/flowctl_state_path.sh"
WORKFLOW_SCRIPT="$REPO_ROOT/scripts/flowctl.sh"

# Writable home for sandbox/CI (default ~/.flowctl may be unwritable).
FLOWCTL_TEST_HOME="$REPO_ROOT/.flowctl-test-home-complexity-$$"
export FLOWCTL_HOME="$FLOWCTL_TEST_HOME"
mkdir -p "$FLOWCTL_HOME"

if [[ ! -x "$WORKFLOW_SCRIPT" ]]; then
  chmod +x "$WORKFLOW_SCRIPT"
fi

if ! flowctl_ensure_repo_state "$REPO_ROOT" "$WORKFLOW_SCRIPT"; then
  echo "Cannot resolve or create workflow state under $REPO_ROOT" >&2
  exit 1
fi

BACKUP_FILE="$(mktemp)"
cp "$STATE_FILE" "$BACKUP_FILE"

cleanup() {
  cp "$BACKUP_FILE" "$STATE_FILE"
  rm -f "$BACKUP_FILE"
  rm -rf "$FLOWCTL_TEST_HOME"
}
trap cleanup EXIT

strip_ansi() {
  printf '%s' "$1" | perl -pe 's/\e\[[0-9;]*m//g'
}

assert_contains() {
  local needle="$1"
  local haystack="$2"
  local label="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Assertion failed: $label (expected substring: $needle)" >&2
    echo "--- output (stripped) ---" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

assert_not_contains() {
  local needle="$1"
  local haystack="$2"
  local label="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "Assertion failed: $label (must not contain: $needle)" >&2
    echo "--- output (stripped) ---" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

patch_step4_clean() {
  python3 - <<PY
import json
from pathlib import Path
p = Path("$STATE_FILE")
d = json.loads(p.read_text(encoding="utf-8"))
d["current_step"] = 4
s = d.setdefault("steps", {}).setdefault("4", {})
if "dispatch_risk" in s:
    del s["dispatch_risk"]
p.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
PY
}

echo "==> Step 4 clean: complexity STANDARD (score below threshold 4)"
patch_step4_clean
OUT="$(strip_ansi "$(bash "$WORKFLOW_SCRIPT" complexity 2>&1)")"
assert_contains "STANDARD" "$OUT" "tier STANDARD for low score"
# Score depends on repo hints (graphify/git); allow 2 or 3 / 5 — both below War Room threshold 4.
if ! echo "$OUT" | grep -qE 'Score[[:space:]]*:[[:space:]]*[23][[:space:]]*/[[:space:]]*5'; then
  echo "Assertion failed: expected complexity score 2 or 3 / 5 (below threshold)" >&2
  echo "$OUT" >&2
  exit 1
fi

echo "==> cursor-dispatch --skip-war-room: no War Room gate, Phase A runs"
OUT="$(strip_ansi "$(bash "$WORKFLOW_SCRIPT" cursor-dispatch --skip-war-room 2>&1)")"
assert_not_contains "War Room trước khi dispatch" "$OUT" "skip-war-room must not enter war room gate"
assert_contains "Generating briefs" "$OUT" "phase A brief generation"
assert_contains "CURSOR SPAWN BOARD" "$OUT" "spawn board"

echo "==> cursor-dispatch (no flags, low score): explicit Skip War Room line then dispatch"
patch_step4_clean
OUT="$(strip_ansi "$(bash "$WORKFLOW_SCRIPT" cursor-dispatch 2>&1)")"
assert_contains "Skip War Room, dispatch ngay" "$OUT" "default path when score < threshold"

echo "==> cursor-dispatch --high-risk triggers War Room (score >= 4)"
patch_step4_clean
OUT="$(strip_ansi "$(bash "$WORKFLOW_SCRIPT" cursor-dispatch --high-risk 2>&1)")"
assert_contains "War Room trước khi dispatch" "$OUT" "high-risk war room gate"

echo "==> cursor-dispatch --impacted-modules 3 triggers War Room (impacted > 2)"
patch_step4_clean
OUT="$(strip_ansi "$(bash "$WORKFLOW_SCRIPT" cursor-dispatch --impacted-modules 3 2>&1)")"
assert_contains "War Room trước khi dispatch" "$OUT" "impacted_modules scoring gate"

echo "==> cursor-dispatch --force-war-room always War Room"
patch_step4_clean
OUT="$(strip_ansi "$(bash "$WORKFLOW_SCRIPT" cursor-dispatch --force-war-room 2>&1)")"
assert_contains "War Room trước khi dispatch" "$OUT" "force war room"
assert_contains "force-war-room" "$OUT" "force flag echoed"

echo "Complexity / War Room tests passed."
