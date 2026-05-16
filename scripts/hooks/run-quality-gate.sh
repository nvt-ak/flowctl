#!/usr/bin/env bash
set -euo pipefail
# Ported wrapper (Phase 6): delegates to src/hooks/quality-gate.ts when Bun + file exist.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
if command -v bun &>/dev/null && [[ -f "$ROOT/src/hooks/quality-gate.ts" ]]; then
  exec bun run "$ROOT/src/hooks/quality-gate.ts" -- "$@"
fi

mode="ci"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      mode="${2:-ci}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: run-quality-gate.sh [--mode ci|local]" >&2
      exit 1
      ;;
  esac
done

if [[ "$mode" == "local" ]]; then
  echo "[gate] Running local quality gate: npm run test:tdd"
  npm run test:tdd
  exit 0
fi

if [[ "$mode" == "ci" ]]; then
  echo "[gate] Running CI quality gate: npm run ci:gate"
  npm run ci:gate
  exit 0
fi

echo "Invalid mode: $mode (expected ci|local)" >&2
exit 1
