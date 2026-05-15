"""
Priority 3 plan fixes: T2 (slim rules), T3 (war room threshold + reuse), T5 (Mode B), T6 (skills-to-load).
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import uuid
from datetime import datetime
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FLOWCTL_SH = REPO_ROOT / "scripts" / "flowctl.sh"
TEMPLATE = REPO_ROOT / "templates" / "flowctl-state.template.json"
AGENTS_DIR = REPO_ROOT / ".cursor" / "agents"

SKIP_BASH = not FLOWCTL_SH.is_file()


def _make_flow_project(
    base: Path,
    label: str = "plan-p3-test",
    *,
    war_room_threshold: int | None = None,
) -> tuple[Path, str]:
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
            "current_step": 2,
            "created_at": now,
            "updated_at": now,
        }
    )
    tpl.setdefault("steps", {}).setdefault("2", {})["status"] = "in_progress"
    if war_room_threshold is not None:
        tpl.setdefault("settings", {})["war_room_threshold"] = war_room_threshold

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


def _run_flowctl(project_dir: Path, *args: str, flowctl_home: Path | None = None, env: dict | None = None) -> subprocess.CompletedProcess[str]:
    home = flowctl_home or (project_dir / ".flowctl_home")
    run_env = {
        **os.environ,
        "PROJECT_ROOT": str(project_dir),
        "FLOWCTL_PROJECT_ROOT": str(project_dir),
        "FLOWCTL_HOME": str(home),
        "WF_SKIP_MCP_HEALTH": "1",
    }
    if env:
        run_env.update(env)
    return subprocess.run(
        ["bash", str(FLOWCTL_SH), *args],
        cwd=str(project_dir),
        env=run_env,
        capture_output=True,
        text=True,
        timeout=90,
    )


class TestT2SlimRules:
    def test_core_rules_slim_is_always_apply_and_shorter_than_full(self) -> None:
        slim = REPO_ROOT / ".cursor/rules/core-rules.mdc"
        full = REPO_ROOT / ".cursor/rules/core-rules-full.mdc"
        assert slim.is_file()
        assert full.is_file()
        slim_text = slim.read_text(encoding="utf-8")
        full_text = full.read_text(encoding="utf-8")
        assert "alwaysApply: true" in slim_text
        assert "alwaysApply: false" in full_text
        assert len(slim_text) < len(full_text) * 0.6
        assert "NEVER" in slim_text
        assert "Document retention" in full_text

    def test_step_quality_gates_exists(self) -> None:
        gates = REPO_ROOT / ".cursor/rules/step-quality-gates.mdc"
        assert gates.is_file()
        text = gates.read_text(encoding="utf-8")
        assert "Test coverage" in text
        assert "globs:" in text


class TestT3WarRoom:
    @pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
    def test_war_room_threshold_from_settings(self, tmp_path: Path) -> None:
        proj, _ = _make_flow_project(tmp_path / "proj", war_room_threshold=5)
        r = _run_flowctl(proj, "complexity", flowctl_home=tmp_path / "home")
        assert r.returncode == 0, r.stderr
        assert "5" in r.stdout

    @pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
    def test_war_room_reuse_when_outputs_newer_than_state(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj", war_room_threshold=1)
        short = fid[3:11]
        wr_dir = proj / "workflows" / short / "dispatch" / "step-2" / "war-room"
        wr_dir.mkdir(parents=True, exist_ok=True)
        state_file = proj / ".flowctl" / "flows" / short / "state.json"

        # Stale state, fresh war room outputs
        old = time.time() - 3600
        os.utime(state_file, (old, old))
        (wr_dir / "pm-analysis.md").write_text("# PM\nDone\n", encoding="utf-8")
        (wr_dir / "tech-lead-assessment.md").write_text("# TL\nDone\n", encoding="utf-8")
        time.sleep(0.05)

        r2 = _run_flowctl(proj, "war-room", flowctl_home=tmp_path / "home")
        combined = r2.stdout + r2.stderr
        assert r2.returncode == 0, combined
        assert "Reusing" in combined or "reuse" in combined.lower()


class TestT5ModeB:
    @pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
    def test_spawn_board_defaults_to_mode_b(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        short = fid[3:11]
        dispatch = proj / "workflows" / short / "dispatch" / "step-2"
        dispatch.mkdir(parents=True, exist_ok=True)
        (dispatch / "tech-lead-brief.md").write_text("# brief\n", encoding="utf-8")

        r = _run_flowctl(
            proj,
            "cursor-dispatch",
            "--skip-war-room",
            flowctl_home=tmp_path / "home",
            env={"WF_WAR_ROOM_THRESHOLD": "9"},
        )
        assert r.returncode == 0, r.stderr
        combined = r.stdout + r.stderr
        assert "MODE B" in combined
        assert "DEFAULT" in combined

        board = dispatch / "spawn-board.txt"
        if board.is_file():
            assert "Mode B" in board.read_text(encoding="utf-8")


class TestT6SkillsToLoad:
    def test_all_agent_files_declare_skills_to_load(self) -> None:
        agents = sorted(AGENTS_DIR.glob("*-agent.md"))
        assert len(agents) >= 5
        missing = []
        for path in agents:
            text = path.read_text(encoding="utf-8")
            if "skills-to-load:" not in text:
                missing.append(path.name)
            elif "compact:" not in text:
                missing.append(f"{path.name} (no compact list)")
        assert not missing, f"Missing skills-to-load: {missing}"

    @pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
    def test_dispatch_brief_mentions_compact_skills(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        short = fid[3:11]
        r = _run_flowctl(
            proj,
            "dispatch",
            "--dry-run",
            flowctl_home=tmp_path / "home",
        )
        assert r.returncode == 0, r.stderr
        briefs = list((proj / "workflows" / short / "dispatch" / "step-2").glob("*-brief.md"))
        assert briefs, "expected at least one brief"
        text = briefs[0].read_text(encoding="utf-8")
        assert "skills-to-load.compact" in text
