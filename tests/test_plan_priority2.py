"""
Priority 2 plan fixes: U2 (generate-plan) + U1D (SUGGESTED_SKIPS in collect).
"""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
FLOWCTL_SH = REPO_ROOT / "scripts" / "flowctl.sh"
TEMPLATE = REPO_ROOT / "templates" / "flowctl-state.template.json"

SKIP_BASH = not FLOWCTL_SH.is_file()


def _make_flow_project(base: Path, label: str = "plan-p2-test") -> tuple[Path, str]:
    flow_id = f"wf-{__import__('uuid').uuid4()}"
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
    tpl.setdefault("steps", {}).setdefault("1", {})["status"] = "in_progress"
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


def _run_flowctl(project_dir: Path, *args: str, flowctl_home: Path | None = None) -> subprocess.CompletedProcess[str]:
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
        timeout=90,
    )


@pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
class TestU2GeneratePlan:
    def test_generate_plan_writes_markdown(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        short = fid[3:11]
        r = _run_flowctl(proj, "generate-plan", flowctl_home=tmp_path / "home")
        assert r.returncode == 0, f"{r.stderr}\n{r.stdout}"
        plan_path = proj / "workflows" / short / "plans" / "plan.md"
        assert plan_path.is_file(), f"expected {plan_path}"
        text = plan_path.read_text(encoding="utf-8")
        assert "plan-p2-test" in text
        assert "Regenerate:" in text or "generate-plan" in text
        assert "Step" in text

    def test_approve_step1_generates_plan(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        short = fid[3:11]
        # Minimal deliverable so gate may pass — use skip-gate for deterministic test
        reports = proj / "workflows" / short / "dispatch" / "step-1" / "reports"
        reports.mkdir(parents=True, exist_ok=True)
        (reports / "pm-report.md").write_text(
            "# Report\n## SUMMARY\nDone\n## DELIVERABLES\n- DELIVERABLE: README.md — doc\n"
            "## DECISIONS\n- DECISION: scope ok\n## BLOCKERS\n- BLOCKER: NONE\n",
            encoding="utf-8",
        )
        _run_flowctl(proj, "collect", flowctl_home=tmp_path / "home")
        r = _run_flowctl(
            proj,
            "approve",
            "--skip-gate",
            "--by",
            "Tester",
            flowctl_home=tmp_path / "home",
        )
        assert r.returncode == 0, f"{r.stderr}\n{r.stdout}"
        plan_path = proj / "workflows" / short / "plans" / "plan.md"
        assert plan_path.is_file()
        assert "plan-p2-test" in plan_path.read_text(encoding="utf-8")


@pytest.mark.skipif(SKIP_BASH, reason="flowctl.sh missing")
class TestU1DSuggestedSkips:
    def test_collect_surfaces_suggested_skip_command(self, tmp_path: Path) -> None:
        proj, fid = _make_flow_project(tmp_path / "proj")
        short = fid[3:11]
        reports = proj / "workflows" / short / "dispatch" / "step-1" / "reports"
        reports.mkdir(parents=True, exist_ok=True)
        (reports / "tech-lead-report.md").write_text(
            """# Worker Report — @tech-lead

## SUMMARY
CLI-only tool.

## DELIVERABLES
- DELIVERABLE: main.py — entry

## DECISIONS
- DECISION: API scope only

## SUGGESTED_SKIPS
- SUGGESTED_SKIP: 3 | UI/UX not needed for CLI-only project

## BLOCKERS
- BLOCKER: NONE
""",
            encoding="utf-8",
        )
        r = _run_flowctl(proj, "collect", flowctl_home=tmp_path / "home")
        assert r.returncode == 0, f"{r.stderr}\n{r.stdout}"
        combined = r.stdout + r.stderr
        assert "flowctl skip" in combined
        assert "3" in combined
        assert "UI/UX" in combined or "ui" in combined.lower()
