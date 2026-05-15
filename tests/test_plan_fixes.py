"""
Tests for flowctl Issues Fix Plan (v2.1): B1, B2, T1, T4, U1A.

TDD: these tests define expected behaviour before implementation.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FLOWCTL_SH = REPO_ROOT / "scripts" / "flowctl.sh"
MONITOR_WEB = REPO_ROOT / "scripts" / "monitor-web.py"
CONTEXT_SNAPSHOT_PY = REPO_ROOT / "scripts" / "workflow" / "lib" / "context_snapshot.py"
SHELL_PROXY_JS = REPO_ROOT / "scripts" / "workflow" / "mcp" / "shell-proxy.js"
TEMPLATE = REPO_ROOT / "templates" / "flowctl-state.template.json"

SKIP_BASH = not FLOWCTL_SH.is_file()
SKIP_NODE = shutil.which("node") is None


def _make_flow_project(base: Path, label: str = "plan-test") -> tuple[Path, str]:
    """Minimal flows-first project with active flow."""
    flow_id = f"wf-{uuid.uuid4()}"
    short = flow_id[3:11]
    rel = f".flowctl/flows/{short}/state.json"
    dest = base / rel
    dest.parent.mkdir(parents=True, exist_ok=True)

    tpl = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tpl.update(
        {
            "flow_id": flow_id,
            "project_name": label,
            "overall_status": "in_progress",
            "current_step": 1,
            "created_at": now,
            "updated_at": now,
        }
    )
    tpl.setdefault("steps", {}).setdefault("1", {})["status"] = "pending"
    dest.write_text(json.dumps(tpl, indent=2, ensure_ascii=False), encoding="utf-8")

    flows_json = base / ".flowctl" / "flows.json"
    flows_json.parent.mkdir(parents=True, exist_ok=True)
    idx = {
        "version": 1,
        "active_flow_id": flow_id,
        "flows": {flow_id: {"state_file": rel, "label": label}},
    }
    flows_json.write_text(json.dumps(idx, indent=2) + "\n", encoding="utf-8")
    return base, flow_id


def _run_flowctl(
    project_dir: Path,
    *args: str,
    flowctl_home: Path | None = None,
    timeout: int = 60,
) -> subprocess.CompletedProcess[str]:
    home = flowctl_home or (project_dir / ".flowctl_home")
    env = {
        **os.environ,
        "PROJECT_ROOT": str(project_dir),
        "FLOWCTL_PROJECT_ROOT": str(project_dir),
        "FLOWCTL_HOME": str(home),
    }
    return subprocess.run(
        ["bash", str(FLOWCTL_SH), *args],
        cwd=str(project_dir),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


# ── B1: monitor-web.py sys.path ─────────────────────────────────────────────


class TestB1MonitorImport:
    def test_sys_path_root_points_at_scripts_not_repo_root(self) -> None:
        """Line 13 must use .parent (scripts/), not .parent.parent (repo root)."""
        text = MONITOR_WEB.read_text(encoding="utf-8")
        match = re.search(
            r"^_sys_path_root\s*=\s*Path\(__file__\)\.resolve\(\)\.parent(\.parent)?",
            text,
            re.MULTILINE,
        )
        assert match is not None, "_sys_path_root assignment not found"
        assert match.group(1) is None, (
            "B1: _sys_path_root must be .parent (scripts/) only; "
            ".parent.parent breaks lib.state_resolver import"
        )

    def test_script_parent_still_uses_repo_root(self) -> None:
        """Line 38 _script_parent must remain .parent.parent for REPO fallback."""
        text = MONITOR_WEB.read_text(encoding="utf-8")
        assert "_script_parent = Path(__file__).resolve().parent.parent" in text

    def test_lib_import_via_scripts_path(self) -> None:
        scripts = REPO_ROOT / "scripts"
        sys.path.insert(0, str(scripts))
        try:
            from lib.state_resolver import resolve_state_file  # noqa: F401
        finally:
            sys.path.remove(str(scripts))


# ── B2: MCP / monitor / audit cache path alignment ──────────────────────────


@pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
class TestB2CachePaths:
    def test_cmd_mcp_runs_ensure_data_dirs_before_exec(self) -> None:
        body = FLOWCTL_SH.read_text(encoding="utf-8")
        start = body.find("cmd_mcp()")
        assert start >= 0, "cmd_mcp not found"
        end = body.find("\ncmd_audit_tokens()", start)
        assert end > start, "cmd_audit_tokens boundary not found"
        block = body[start:end]
        assert "flowctl_refresh_runtime_paths" in block
        assert "flowctl_ensure_data_dirs" in block
        assert "FLOWCTL_CACHE_DIR" in block
        assert "FLOWCTL_EVENTS_F" in block

    def test_monitor_exports_cache_env(self) -> None:
        body = FLOWCTL_SH.read_text(encoding="utf-8")
        mon = re.search(
            r"monitor\|mon\)\s*\n(.*?)(?=\n  [a-zA-Z_-]+\|)",
            body,
            re.DOTALL,
        )
        assert mon is not None, "monitor|mon) case not found"
        block = mon.group(1)
        assert "flowctl_refresh_runtime_paths" in block
        assert "FLOWCTL_CACHE_DIR" in block
        assert "FLOWCTL_EVENTS_F" in block

    def test_cmd_audit_tokens_refreshes_and_warns_missing_events(self, tmp_path: Path) -> None:
        proj, _ = _make_flow_project(tmp_path / "proj")
        home = tmp_path / "flowctl_home"
        r = _run_flowctl(proj, "audit-tokens", flowctl_home=home, timeout=30)
        assert r.returncode == 0, r.stderr
        # No MCP activity yet — should warn about missing events (not silent empty)
        assert (
            "events.jsonl" in (r.stdout + r.stderr).lower()
            or "không tồn tại" in (r.stdout + r.stderr).lower()
            or "not exist" in (r.stdout + r.stderr).lower()
        )

    @pytest.mark.skipif(SKIP_NODE, reason="node.js required")
    def test_mcp_spawn_creates_meta_and_logs_cache_dir(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        home = tmp_path / "flowctl_home"
        env = {
            **os.environ,
            "PROJECT_ROOT": str(proj),
            "FLOWCTL_PROJECT_ROOT": str(proj),
            "FLOWCTL_HOME": str(home),
        }
        proc = subprocess.Popen(
            ["bash", str(FLOWCTL_SH), "mcp", "--shell-proxy"],
            cwd=str(proj),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            time.sleep(1.2)
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()

        stderr = proc.stderr.read() if proc.stderr else ""
        assert "[shell-proxy]" in stderr and "cache dir:" in stderr, (
            f"Expected startup cache log on stderr, got: {stderr[:500]!r}"
        )

        short = fid[3:11]
        meta_candidates = list((home / "projects").glob("*/meta.json"))
        assert meta_candidates, (
            f"meta.json not created under {home / 'projects'} after mcp spawn"
        )

    def test_shell_proxy_js_logs_events_path_on_startup(self) -> None:
        text = SHELL_PROXY_JS.read_text(encoding="utf-8")
        assert "cache dir:" in text and "events file:" in text


# ── T4: context snapshot freshness ──────────────────────────────────────────


class TestT4SnapshotFreshness:
    def test_fresh_snapshot_mentions_fresh(self, tmp_path: Path) -> None:
        snap_mod_dir = str(CONTEXT_SNAPSHOT_PY.parent)
        if snap_mod_dir not in sys.path:
            sys.path.insert(0, snap_mod_dir)
        from context_snapshot import build_snapshot as bs  # noqa: E402

        state = tmp_path / "state.json"
        state.write_text(
            json.dumps(
                {
                    "project_name": "T",
                    "current_step": 1,
                    "steps": {
                        "1": {
                            "name": "Req",
                            "status": "pending",
                            "agent": "pm",
                            "decisions": [],
                            "blockers": [],
                        }
                    },
                }
            ),
            encoding="utf-8",
        )
        md = bs(state, "1", tmp_path, generated_at=datetime.now())
        assert "**FRESH**" in md
        assert "wf_step_context()" in md.lower() or "wf_state()" in md.lower()

    def test_stale_snapshot_mentions_stale(self, tmp_path: Path) -> None:
        snap_mod_dir = str(CONTEXT_SNAPSHOT_PY.parent)
        if snap_mod_dir not in sys.path:
            sys.path.insert(0, snap_mod_dir)
        from context_snapshot import build_snapshot as bs  # noqa: E402

        state = tmp_path / "state.json"
        state.write_text(
            json.dumps(
                {
                    "project_name": "T",
                    "current_step": 1,
                    "steps": {
                        "1": {
                            "name": "Req",
                            "status": "pending",
                            "agent": "pm",
                            "decisions": [],
                            "blockers": [],
                        }
                    },
                }
            ),
            encoding="utf-8",
        )
        old = datetime.now() - timedelta(hours=2)
        md = bs(state, "1", tmp_path, generated_at=old)
        assert "**STALE**" in md or "⚠" in md


# ── U1A: assess lists all skip presets ─────────────────────────────────────


@pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
class TestU1AssessPresets:
    @pytest.mark.parametrize(
        "preset",
        [
            "hotfix",
            "api-only",
            "backend-api",
            "frontend-only",
            "design-sprint",
            "research",
            "devops-only",
            "qa-only",
        ],
    )
    def test_assess_output_mentions_preset(self, tmp_path: Path, preset: str) -> None:
        proj, _ = _make_flow_project(tmp_path / "proj")
        r = _run_flowctl(proj, "assess", flowctl_home=tmp_path / "home")
        assert r.returncode == 0, r.stderr
        combined = r.stdout + r.stderr
        assert preset in combined, f"assess output should mention preset {preset!r}"


# ── T1: context-snapshot.md file + brief reference ─────────────────────────


@pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
class TestT1ContextSnapshotFile:
    def test_dispatch_writes_snapshot_file_and_brief_references_it(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        short = fid[3:11]
        dispatch_step = proj / "workflows" / short / "dispatch" / "step-1"
        dispatch_step.mkdir(parents=True, exist_ok=True)

        r = _run_flowctl(
            proj,
            "dispatch",
            flowctl_home=tmp_path / "home",
            timeout=90,
        )
        assert r.returncode == 0, f"dispatch failed: {r.stderr}\n{r.stdout}"

        snap_file = dispatch_step / "context-snapshot.md"
        assert snap_file.is_file(), "context-snapshot.md must be written per step"

        pm_brief = dispatch_step / "pm-brief.md"
        assert pm_brief.is_file(), "pm-brief.md expected for step 1"
        brief_text = pm_brief.read_text(encoding="utf-8")
        assert "context-snapshot.md" in brief_text
        # Embedded duplicate table should not repeat full snapshot body
        assert brief_text.count("## Context Snapshot (Step") <= 1
