#!/usr/bin/env python3
"""
Resolve absolute path to flowctl workflow state JSON.

Priority:
  1. FLOWCTL_STATE_FILE — absolute or relative to REPO_ROOT
  2. FLOWCTL_ACTIVE_FLOW — flow_id (wf-...) matched against .flowctl/flows.json or ~/.flowctl/projects/*/meta.json
  3. .flowctl/flows.json active_flow_id entry
  4. (none) → {"state_file": "", "source": "not_initialized"} — config.sh may run legacy migrate

Prints one JSON object to stdout (single line) for bash parsing:
  {"state_file": "<abs or empty>", "source": "env_state_file|env_active_flow|flows_json|not_initialized"}
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _norm(p: str) -> str:
    try:
        return str(Path(p).resolve())
    except OSError:
        return str(Path(p))


def _load_flows_index(repo: Path) -> dict | None:
    p = repo / ".flowctl" / "flows.json"
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _resolve_state_file_field(repo: Path, raw: str) -> Path:
    q = Path(raw)
    if q.is_absolute():
        return q
    return (repo / q).resolve()


def _meta_matches_repo(meta: dict, repo_norm: str) -> bool:
    path = meta.get("path") or ""
    if not path:
        return False
    return _norm(path) == repo_norm


def _find_state_via_registry(flowctl_home: Path, flow_id: str, repo_norm: str) -> Path | None:
    projects = flowctl_home / "projects"
    if not projects.is_dir():
        return None
    for child in sorted(projects.iterdir()):
        meta_p = child / "meta.json"
        if not meta_p.is_file():
            continue
        try:
            meta = json.loads(meta_p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if meta.get("project_id") != flow_id:
            continue
        if not _meta_matches_repo(meta, repo_norm):
            continue
        cache = meta.get("cache_dir") or ""
        if not cache:
            continue
        data_dir = Path(cache).parent
        candidate = data_dir / "workflow" / "state.json"
        if candidate.is_file():
            return candidate.resolve()
    return None


def resolve_state_file(
    repo: Path,
    *,
    env_state_file: str | None,
    env_active_flow: str | None,
    flowctl_home: Path,
) -> tuple[Path | None, str]:
    repo = repo.resolve()
    repo_norm = _norm(str(repo))

    if env_state_file and env_state_file.strip():
        raw = env_state_file.strip()
        p = _resolve_state_file_field(repo, raw)
        return p, "env_state_file"

    flows_index = _load_flows_index(repo)
    active_id = (env_active_flow or "").strip() or None
    if not active_id and flows_index:
        active_id = (flows_index.get("active_flow_id") or "").strip() or None

    if active_id and flows_index:
        flows = flows_index.get("flows") or {}
        entry = flows.get(active_id)
        if isinstance(entry, dict):
            sf = (entry.get("state_file") or "").strip()
            if sf:
                p = _resolve_state_file_field(repo, sf)
                return p, "flows_json"

    if active_id:
        found = _find_state_via_registry(flowctl_home, active_id, repo_norm)
        if found is not None:
            return found, "env_active_flow"

    # No env path, no flows entry, no registry hit — flows-first uninitialized (no default root path).
    return None, "not_initialized"


def main() -> int:
    repo_s = os.environ.get("FLOWCTL_PROJECT_ROOT") or os.environ.get("REPO_ROOT") or ""
    if "--repo" in sys.argv:
        i = sys.argv.index("--repo")
        if i + 1 < len(sys.argv):
            repo_s = sys.argv[i + 1]
    if not repo_s:
        print(json.dumps({"error": "missing REPO_ROOT / FLOWCTL_PROJECT_ROOT / --repo"}), file=sys.stderr)
        return 2
    repo = Path(repo_s)
    home = Path(os.environ.get("FLOWCTL_HOME") or Path.home() / ".flowctl")
    state, src = resolve_state_file(
        repo,
        env_state_file=os.environ.get("FLOWCTL_STATE_FILE"),
        env_active_flow=os.environ.get("FLOWCTL_ACTIVE_FLOW"),
        flowctl_home=home,
    )
    out = {"state_file": str(state) if state is not None else "", "source": src}
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
