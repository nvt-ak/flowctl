#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if command -v bun &>/dev/null && [[ -f "$ROOT/src/hooks/git-guards.ts" ]]; then
  exec bun run "$ROOT/src/hooks/git-guards.ts" pre-push
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
  echo "Push blocked: direct pushes to '$current_branch' are not allowed."
  echo "Create a feature branch and open a PR instead."
  exit 1
fi
