"""Resolve active workflow state file from .flowctl/flows.json (flows-first) with legacy fallback."""

from __future__ import annotations

import json
from pathlib import Path


def resolve_state_file(repo: Path) -> Path | None:
    """Resolve active flow state path from .flowctl/flows.json; fallback to legacy root file.

    Priority: flows.json active_flow_id → any flow entry with existing state_file →
    REPO/flowctl-state.json if present.
    """
    repo = repo.resolve()
    flows_json = repo / ".flowctl" / "flows.json"
    if flows_json.is_file():
        try:
            idx = json.loads(flows_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            idx = None
        if isinstance(idx, dict):
            active = (idx.get("active_flow_id") or "").strip()
            flows = idx.get("flows") or {}
            if active and isinstance(flows.get(active), dict):
                sf = (flows[active].get("state_file") or "").strip()
                if sf:
                    p = Path(sf) if Path(sf).is_absolute() else (repo / sf)
                    if p.is_file():
                        return p.resolve()
            for _fid, meta in flows.items():
                if not isinstance(meta, dict):
                    continue
                sf = (meta.get("state_file") or "").strip()
                if not sf:
                    continue
                p = Path(sf) if Path(sf).is_absolute() else (repo / sf)
                if p.is_file():
                    return p.resolve()
    legacy = repo / "flowctl-state.json"
    if legacy.is_file():
        return legacy.resolve()
    return None
