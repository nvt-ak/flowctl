#!/usr/bin/env python3
"""One-time migration: move root flowctl-state.json → .flowctl/flows/<short>/state.json.

Reads REPO_ROOT from environment. Prints absolute path of new state file on stdout when
migration runs; prints nothing when no migration needed. Exit code 0 always.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path


def main() -> int:
    repo = Path(os.environ.get("REPO_ROOT", "")).resolve()
    if not repo.is_dir():
        return 0
    flows_p = repo / ".flowctl" / "flows.json"
    if flows_p.is_file():
        return 0
    root = repo / "flowctl-state.json"
    if not root.is_file() or root.is_symlink():
        return 0
    try:
        data = json.loads(root.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return 0
    fid = (data.get("flow_id") or "").strip()
    if not fid or not fid.startswith("wf-"):
        return 0
    short = fid.replace("wf-", "").replace("-", "")[:8] or "legacy"
    dest_dir = repo / ".flowctl" / "flows" / short
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "state.json"
    if dest.is_file():
        return 0
    try:
        shutil.move(str(root), str(dest))
    except OSError:
        return 0
    rel = str(dest.relative_to(repo))
    idx = {
        "version": 1,
        "active_flow_id": fid,
        "flows": {fid: {"state_file": rel, "label": "migrated-root"}},
    }
    flows_p.parent.mkdir(parents=True, exist_ok=True)
    flows_p.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(dest.resolve(), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
