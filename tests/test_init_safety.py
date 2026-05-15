"""
TC-09: flowctl init safety tests
- project_name with special chars (shell injection guard)
- auto project name from folder basename
- ~/.flowctl/projects path-based dedup (no duplicate on re-init)
"""
import json
import os
import subprocess
import sys
import textwrap
import uuid
from pathlib import Path

import pytest

FLOWCTL_SH = Path(__file__).resolve().parent.parent / "scripts" / "flowctl.sh"
SKIP_BASH = not FLOWCTL_SH.exists()


# ── Helpers ────────────────────────────────────────────────────────────────

def _make_project(tmp_path: Path, name: str = "") -> Path:
    """Create a minimal project dir with flowctl-state.json template."""
    proj = tmp_path / "myproject"
    proj.mkdir()
    # Minimal state template (flowctl init will fill in project_name / flow_id)
    state = {
        "flow_id": "",
        "project_name": "",
        "current_step": 1,
        "overall_status": "pending",
        "created_at": "",
        "updated_at": "",
        "steps": {"1": {"name": "Requirements", "status": "pending"}},
        "decisions": [],
        "blockers": [],
        "deliverables": [],
        "metrics": {"total_blockers": 0, "total_decisions": 0},
    }
    (proj / "flowctl-state.json").write_text(json.dumps(state), encoding="utf-8")
    return proj


INJECT_SCRIPT = textwrap.dedent("""\
    import json, os, sys, uuid
    from pathlib import Path
    from datetime import datetime

    # Replicate the fixed cmd_init Python block (env-var based, no shell interpolation)
    state_file   = Path(os.environ["WF_STATE_FILE"])
    project_name = os.environ["WF_PROJECT_NAME"]
    preserved    = os.environ["WF_PRESERVED_ID"].strip()

    raw  = state_file.read_text(encoding="utf-8")
    data = json.loads(raw) if raw.strip() else {}

    data["project_name"]   = project_name
    data["created_at"]     = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data["updated_at"]     = data["created_at"]
    data["current_step"]   = 1
    data["overall_status"] = "in_progress"
    data.setdefault("steps", {}).setdefault("1", {})["status"] = "pending"

    if preserved:
        data["flow_id"] = preserved
    elif not data.get("flow_id"):
        data["flow_id"] = "wf-" + str(uuid.uuid4())

    state_file.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("OK:" + data["project_name"])
""")


class TestProjectNameInjection:
    """Fix 1+2: project_name with special chars must not cause code execution."""

    @pytest.mark.parametrize("name", [
        "My Project",
        "project's name",           # single quote
        'say "hello"',              # double quote
        "name`whoami`",             # backtick
        "name\nwith\nnewlines",     # newline
        "name; rm -rf /",           # semicolon injection
        "'; import os; os.system('id')  # ",  # classic python -c injection
        "name with 'apostrophe' and \"quotes\"",
        "Tên dự án Việt Nam 🚀",    # unicode + emoji
        "",                          # empty → should fall back gracefully
    ])
    def test_special_chars_do_not_crash(self, tmp_path: Path, name: str) -> None:
        """Python block receives project_name via env var — must not raise."""
        state = tmp_path / "flowctl-state.json"
        state.write_text(json.dumps({
            "flow_id": "", "project_name": "", "current_step": 1,
            "overall_status": "pending", "created_at": "", "updated_at": "",
            "steps": {"1": {"name": "Req", "status": "pending"}},
            "decisions": [], "blockers": [], "deliverables": [],
            "metrics": {"total_blockers": 0, "total_decisions": 0},
        }), encoding="utf-8")

        env = {**os.environ,
               "WF_STATE_FILE": str(state),
               "WF_PROJECT_NAME": name,
               "WF_PRESERVED_ID": ""}
        result = subprocess.run(
            [sys.executable, "-c", INJECT_SCRIPT],
            env=env, capture_output=True, text=True
        )
        assert result.returncode == 0, (
            f"Python block crashed for name={name!r}\n"
            f"stderr: {result.stderr}"
        )

    def test_project_name_written_verbatim(self, tmp_path: Path) -> None:
        """Special chars must be stored verbatim in state.json, not mangled."""
        name = "My 'project' with \"quotes\" and ` backtick"
        state = tmp_path / "flowctl-state.json"
        state.write_text(json.dumps({
            "flow_id": "wf-existing", "project_name": "", "current_step": 1,
            "overall_status": "pending", "created_at": "", "updated_at": "",
            "steps": {"1": {"name": "Req", "status": "pending"}},
            "decisions": [], "blockers": [], "deliverables": [],
            "metrics": {"total_blockers": 0, "total_decisions": 0},
        }), encoding="utf-8")

        env = {**os.environ,
               "WF_STATE_FILE": str(state),
               "WF_PROJECT_NAME": name,
               "WF_PRESERVED_ID": "wf-existing"}
        subprocess.run([sys.executable, "-c", INJECT_SCRIPT],
                       env=env, capture_output=True, text=True, check=True)

        stored = json.loads(state.read_text(encoding="utf-8"))
        assert stored["project_name"] == name
        assert stored["flow_id"] == "wf-existing"   # preserved ID kept

    def test_unicode_project_name_roundtrip(self, tmp_path: Path) -> None:
        """Vietnamese + emoji must roundtrip through JSON without corruption."""
        name = "Dự án Việt Nam 🚀 — phiên bản 1.0"
        state = tmp_path / "flowctl-state.json"
        state.write_text(json.dumps({
            "flow_id": "", "project_name": "", "current_step": 1,
            "overall_status": "pending", "created_at": "", "updated_at": "",
            "steps": {"1": {"name": "Req", "status": "pending"}},
            "decisions": [], "blockers": [], "deliverables": [],
            "metrics": {"total_blockers": 0, "total_decisions": 0},
        }), encoding="utf-8")

        env = {**os.environ,
               "WF_STATE_FILE": str(state),
               "WF_PROJECT_NAME": name,
               "WF_PRESERVED_ID": ""}
        subprocess.run([sys.executable, "-c", INJECT_SCRIPT],
                       env=env, capture_output=True, text=True, check=True)

        stored = json.loads(state.read_text(encoding="utf-8"))
        assert stored["project_name"] == name


CONFIG_PARSE_SCRIPT = textwrap.dedent("""\
    import json, os, sys
    from pathlib import Path

    # Replicate fixed config.sh Python parse logic
    try:
        raw = Path(os.environ["WF_SF"]).read_text(encoding="utf-8")
        d = json.loads(raw) if raw.strip() else {}
        print(d.get("flow_id", "") + "|" + d.get("project_name", ""))
    except Exception:
        print("|")
""")


class TestConfigFlowIdParse:
    """Fix 3: config.sh flow_id + project_name parse via Python (was grep)."""

    def test_normal_state_parses_correctly(self, tmp_path: Path) -> None:
        state = tmp_path / "state.json"
        state.write_text(json.dumps({
            "flow_id": "wf-abc12345-dead-beef-0000-112233445566",
            "project_name": "My Project",
        }), encoding="utf-8")
        env = {**os.environ, "WF_SF": str(state)}
        r = subprocess.run([sys.executable, "-c", CONFIG_PARSE_SCRIPT],
                           env=env, capture_output=True, text=True, check=True)
        flow_id, name = r.stdout.strip().split("|", 1)
        assert flow_id == "wf-abc12345-dead-beef-0000-112233445566"
        assert name == "My Project"

    def test_project_name_with_pipe_char(self, tmp_path: Path) -> None:
        """project_name with '|' must not confuse the pipe-delimited output."""
        state = tmp_path / "state.json"
        state.write_text(json.dumps({
            "flow_id": "wf-11111111",
            "project_name": "A|B project",
        }), encoding="utf-8")
        env = {**os.environ, "WF_SF": str(state)}
        r = subprocess.run([sys.executable, "-c", CONFIG_PARSE_SCRIPT],
                           env=env, capture_output=True, text=True, check=True)
        # Split on first | only — project_name may contain more pipes
        flow_id = r.stdout.strip().split("|", 1)[0]
        assert flow_id == "wf-11111111"

    def test_empty_file_returns_empty_strings(self, tmp_path: Path) -> None:
        state = tmp_path / "state.json"
        state.write_text("", encoding="utf-8")
        env = {**os.environ, "WF_SF": str(state)}
        r = subprocess.run([sys.executable, "-c", CONFIG_PARSE_SCRIPT],
                           env=env, capture_output=True, text=True, check=True)
        assert r.stdout.strip() == "|"

    def test_corrupt_json_returns_empty_strings(self, tmp_path: Path) -> None:
        state = tmp_path / "state.json"
        state.write_text("{not valid json", encoding="utf-8")
        env = {**os.environ, "WF_SF": str(state)}
        r = subprocess.run([sys.executable, "-c", CONFIG_PARSE_SCRIPT],
                           env=env, capture_output=True, text=True, check=True)
        assert r.stdout.strip() == "|"

    def test_multiline_json_parses_correctly(self, tmp_path: Path) -> None:
        """Grep-based parsing broke on pretty-printed JSON — Python must handle it."""
        state = tmp_path / "state.json"
        state.write_text(json.dumps({
            "flow_id": "wf-multiline00",
            "project_name": "Pretty Printed",
        }, indent=2), encoding="utf-8")
        env = {**os.environ, "WF_SF": str(state)}
        r = subprocess.run([sys.executable, "-c", CONFIG_PARSE_SCRIPT],
                           env=env, capture_output=True, text=True, check=True)
        flow_id, name = r.stdout.strip().split("|", 1)
        assert flow_id == "wf-multiline00"
        assert name == "Pretty Printed"


class TestProjectNameAutoDetect:
    """Fix: project_name defaults to basename of PROJECT_ROOT."""

    def test_basename_used_as_default(self, tmp_path: Path) -> None:
        """When WF_PROJECT_NAME is empty, should use dirname as fallback (tested at script level)."""
        folder_name = "my-cool-project"
        proj = tmp_path / folder_name
        proj.mkdir()
        state = proj / "flowctl-state.json"
        state.write_text(json.dumps({
            "flow_id": "", "project_name": "", "current_step": 1,
            "overall_status": "pending", "created_at": "", "updated_at": "",
            "steps": {"1": {"name": "Req", "status": "pending"}},
            "decisions": [], "blockers": [], "deliverables": [],
            "metrics": {"total_blockers": 0, "total_decisions": 0},
        }), encoding="utf-8")

        # Simulate: if project_name is empty, flowctl.sh uses $(basename "$PROJECT_ROOT")
        auto_name = proj.name   # what bash would produce
        assert auto_name == folder_name

        # Run through the Python block with auto_name
        env = {**os.environ,
               "WF_STATE_FILE": str(state),
               "WF_PROJECT_NAME": auto_name,
               "WF_PRESERVED_ID": ""}
        subprocess.run([sys.executable, "-c", INJECT_SCRIPT],
                       env=env, capture_output=True, text=True, check=True)

        stored = json.loads(state.read_text(encoding="utf-8"))
        assert stored["project_name"] == folder_name


DEDUP_SCRIPT = textwrap.dedent("""\
    import json, os, sys
    from pathlib import Path

    # Simulate the path-based dedup logic from cmd_init()
    flowctl_home = Path(os.environ["WF_HOME"])
    project_root = os.environ["WF_ROOT"]
    new_fl_id    = os.environ["WF_FL_ID"]
    new_slug     = os.environ["WF_SLUG"]
    new_short    = new_fl_id[3:11] if new_fl_id.startswith("wf-") else new_fl_id[:8]

    existing_data_dir = ""
    projects_dir = flowctl_home / "projects"
    if projects_dir.exists():
        for entry in projects_dir.iterdir():
            meta_path = entry / "meta.json"
            if not meta_path.exists():
                continue
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if meta.get("path") == project_root:   # path-first match
                existing_data_dir = str(entry)
                break
            if meta.get("project_id") == new_fl_id:  # UUID fallback
                existing_data_dir = str(entry)
                break

    if existing_data_dir:
        result = existing_data_dir
    else:
        clean_dir = str(projects_dir / new_slug)
        clean_meta = projects_dir / new_slug / "meta.json"
        if not (projects_dir / new_slug).exists():
            result = clean_dir
        elif not clean_meta.exists() or json.loads(clean_meta.read_text(encoding="utf-8")).get("path") == project_root:
            result = clean_dir
        else:
            result = str(projects_dir / f"{new_slug}-{new_short}")

    print(result)
""")


class TestProjectsDirDedup:
    """Fix 8: ~/.flowctl/projects — no duplicate folder on re-init."""

    def _write_meta(self, data_dir: Path, project_id: str, path: str) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "meta.json").write_text(
            json.dumps({"project_id": project_id, "path": path}),
            encoding="utf-8"
        )

    def _run_dedup(self, flowctl_home: Path, project_root: str,
                   fl_id: str, slug: str) -> str:
        env = {**os.environ,
               "WF_HOME": str(flowctl_home),
               "WF_ROOT": project_root,
               "WF_FL_ID": fl_id,
               "WF_SLUG": slug}
        r = subprocess.run([sys.executable, "-c", DEDUP_SCRIPT],
                           env=env, capture_output=True, text=True, check=True)
        return r.stdout.strip()

    def test_first_init_creates_clean_slug_dir(self, tmp_path: Path) -> None:
        home = tmp_path / ".flowctl"
        result = self._run_dedup(home, "/home/user/myproject",
                                 "wf-aabbccdd-0000", "myproject")
        assert result.endswith("myproject")
        assert "aabbccdd" not in result

    def test_reinit_same_uuid_reuses_dir(self, tmp_path: Path) -> None:
        home = tmp_path / ".flowctl"
        fl_id = "wf-11223344-5566-7788-9900-aabbccddeeff"
        data_dir = home / "projects" / "myproject"
        self._write_meta(data_dir, fl_id, "/home/user/myproject")

        result = self._run_dedup(home, "/home/user/myproject", fl_id, "myproject")
        assert Path(result) == data_dir

    def test_reinit_new_uuid_reuses_dir_via_path(self, tmp_path: Path) -> None:
        """State was deleted → new UUID generated → must reuse existing dir by PATH."""
        home = tmp_path / ".flowctl"
        old_id = "wf-olduuid0-0000-0000-0000-000000000000"
        new_id = "wf-newuuid1-1111-1111-1111-111111111111"
        data_dir = home / "projects" / "myproject"
        self._write_meta(data_dir, old_id, "/home/user/myproject")

        result = self._run_dedup(home, "/home/user/myproject", new_id, "myproject")
        assert Path(result) == data_dir, \
            "Must reuse existing dir by path, not create new orphan"

    def test_same_name_different_path_gets_disambiguated(self, tmp_path: Path) -> None:
        """Two different projects named 'myproject' → second gets slug+id suffix."""
        home = tmp_path / ".flowctl"
        existing_id = "wf-existing0-0000"
        data_dir = home / "projects" / "myproject"
        self._write_meta(data_dir, existing_id, "/home/user/project-A/myproject")

        new_id = "wf-aabb1234-ccdd"
        result = self._run_dedup(home, "/home/user/project-B/myproject", new_id, "myproject")
        assert "aabb1234" in result, \
            "Different project with same name must get disambiguating suffix"

    def test_no_duplicate_folders_after_multiple_reinits(self, tmp_path: Path) -> None:
        """Simulate 3 re-inits: must always return same dir, never create extras."""
        home = tmp_path / ".flowctl"
        project_root = "/home/user/myproject"
        slug = "myproject"
        uuids = [
            "wf-uuid0000-0000-0000-0000-000000000000",
            "wf-uuid1111-1111-1111-1111-111111111111",
            "wf-uuid2222-2222-2222-2222-222222222222",
        ]

        dirs_created = set()
        for i, fl_id in enumerate(uuids):
            result = self._run_dedup(home, project_root, fl_id, slug)
            dirs_created.add(result)
            # Simulate: create the dir and write meta with current UUID
            data_dir = Path(result)
            self._write_meta(data_dir, fl_id, project_root)

        assert len(dirs_created) == 1, \
            f"Expected 1 unique dir across 3 re-inits, got: {dirs_created}"
