#!/usr/bin/env bash
# Resolve active workflow state path for tests (flows-first + legacy root).
# shellcheck disable=SC2034
# Usage: source from test/*.sh after REPO_ROOT is set, or rely on FLOWCTL_TEST_ENGINE_ROOT.

FLOWCTL_TEST_ENGINE_ROOT="${FLOWCTL_TEST_ENGINE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Print absolute path to state JSON for a project dir, or empty if none.
flowctl_resolve_state_for_project() {
  local proj_dir="${1:?project dir}"
  FLOWCTL_TEST_ENGINE_ROOT="$FLOWCTL_TEST_ENGINE_ROOT" python3 -c "
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(os.environ['FLOWCTL_TEST_ENGINE_ROOT']) / 'scripts'))
from lib.state_resolver import resolve_state_file
repo = Path(sys.argv[1]).resolve()
p = resolve_state_file(repo)
if p is not None:
    print(p, end='')
else:
    leg = repo / 'flowctl-state.json'
    print(leg if leg.is_file() else '', end='')
" "$proj_dir"
}

# Set STATE_FILE and FLOWCTL_STATE_FILE from resolver (project root = first arg or REPO_ROOT).
flowctl_refresh_repo_state() {
  local root="${1:-${REPO_ROOT:-}}"
  [[ -n "$root" ]] || return 1
  local sf
  sf="$(flowctl_resolve_state_for_project "$root")"
  if [[ -z "$sf" || ! -f "$sf" ]]; then
    return 1
  fi
  STATE_FILE="$sf"
  export FLOWCTL_STATE_FILE="$STATE_FILE"
  return 0
}

# Ensure a resolvable state file exists (runs init in project root if needed).
flowctl_ensure_repo_state() {
  local root="${1:-${REPO_ROOT:-}}"
  local wf="${2:-${REPO_ROOT:-}/scripts/flowctl.sh}"
  if flowctl_refresh_repo_state "$root"; then
    return 0
  fi
  (cd "$root" && PROJECT_ROOT="$root" FLOWCTL_SKIP_SETUP=1 bash "$wf" init --no-setup --project "Test Bootstrap" >/dev/null 2>&1) || true
  flowctl_refresh_repo_state "$root"
}
