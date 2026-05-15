"""
tests/test_fork_isolation.py

Coverage: flowctl fork + lock isolation — unit & real-subprocess concurrency.

TC-P01  resolve_state_path: FLOWCTL_ACTIVE_FLOW env → correct state_file, source=flows_json
TC-P02  resolve_state_path: two different FLOWCTL_ACTIVE_FLOW → two distinct state files
TC-P03  resolve_state_path: no flows.json, no env → source=not_initialized, state_file==""
TC-P04  lock hash is sha256(state_file_path)[:16] — deterministic per path
TC-P05  two different state file paths → two different lock hashes (no collision)
TC-P06  same state file path → same lock hash every time (idempotent)
TC-P07  5 concurrent fork subprocesses → 5 unique flow_ids registered in flows.json
TC-P08  fork: active_flow_id in flows.json unchanged after concurrent forks
TC-P09  fork state file: valid JSON, flow_id starts with "wf-", overall_status=in_progress
TC-P10  fork: FLOWCTL_ACTIVE_FLOW in eval'd output points to resolver-reachable state
TC-P11  real lock contention: same WORKFLOW_LOCK_DIR → exactly one winner, rest fail fast
TC-P12  real lock contention: different WORKFLOW_LOCK_DIR → all acquire without blocking
TC-P13  stale lock (non-existent PID) → reclaimed; next acquire succeeds
TC-P14  lock released after subprocess exits (EXIT trap fires within 500ms)
TC-P15  lock hint output contains literal text "flowctl fork"
TC-P16  fork --label stored as project_description in new state file
TC-P17  fork inherits project_name from active flow state
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pytest

# ─────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).parent.parent
RESOLVER   = REPO_ROOT / "scripts" / "workflow" / "lib" / "resolve_state_path.py"
LOCK_SH    = REPO_ROOT / "scripts" / "workflow" / "lib" / "lock.sh"
FLOWCTL_SH = REPO_ROOT / "scripts" / "flowctl.sh"
TEMPLATE   = REPO_ROOT / "templates" / "flowctl-state.template.json"


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

def _make_flow_project(base: Path, label: str = "test-project") -> tuple[Path, str]:
    """Create a minimal initialized project with 1 active flow.

    Returns (project_dir, flow_id).
    """
    flow_id = f"wf-{uuid.uuid4()}"
    short   = flow_id[3:11]
    rel     = f".flowctl/flows/{short}/state.json"
    dest    = base / rel
    dest.parent.mkdir(parents=True, exist_ok=True)

    import datetime
    tpl  = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    tpl.update({
        "flow_id":        flow_id,
        "project_name":   label,
        "overall_status": "in_progress",
        "current_step":   1,
    })
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tpl["created_at"] = tpl["updated_at"] = now
    dest.write_text(json.dumps(tpl, indent=2, ensure_ascii=False), encoding="utf-8")

    flows_json = base / ".flowctl" / "flows.json"
    flows_json.parent.mkdir(parents=True, exist_ok=True)
    idx = {
        "version": 1,
        "active_flow_id": flow_id,
        "flows": {flow_id: {"state_file": rel, "label": label}},
    }
    flows_json.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return base, flow_id


def _lock_hash(state_file_path: str) -> str:
    """Mirror config.sh lock hash computation."""
    return hashlib.sha256(state_file_path.encode("utf-8")).hexdigest()[:16]


def _resolve(project_dir: Path, *, active_flow: str = "", state_file: str = "") -> dict:
    env = {
        **os.environ,
        "FLOWCTL_PROJECT_ROOT": str(project_dir),
        "REPO_ROOT":            str(project_dir),
        "FLOWCTL_ACTIVE_FLOW":  active_flow,
        "FLOWCTL_STATE_FILE":   state_file,
        "FLOWCTL_HOME":         str(project_dir / ".flowctl_home"),
    }
    result = subprocess.run(
        [sys.executable, str(RESOLVER)],
        env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, f"resolver failed: {result.stderr}"
    return json.loads(result.stdout)


def _run_fork(project_dir: Path, label: str = "task") -> str:
    """Run `flowctl fork --label <label>` and return the new flow_id."""
    env = {
        **os.environ,
        "FLOWCTL_PROJECT_ROOT": str(project_dir),
        "PROJECT_ROOT":         str(project_dir),
        "REPO_ROOT":            str(project_dir),
    }
    result = subprocess.run(
        ["bash", str(FLOWCTL_SH), "fork", "--label", label],
        env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, f"fork failed: {result.stderr}"
    # stdout: "export FLOWCTL_ACTIVE_FLOW=wf-..."
    line = result.stdout.strip()
    assert line.startswith("export FLOWCTL_ACTIVE_FLOW="), (
        f"unexpected fork output: {line!r}"
    )
    return line.split("=", 1)[1]


# ─────────────────────────────────────────────────────────────
# TC-P01 … TC-P03: resolve_state_path
# ─────────────────────────────────────────────────────────────

class TestResolveStatePath:
    def test_active_flow_env_resolves_to_correct_state(self, tmp_path: Path) -> None:
        """TC-P01: FLOWCTL_ACTIVE_FLOW → state_file of that flow, source=flows_json."""
        proj, fid = _make_flow_project(tmp_path / "proj")
        # Add a second flow manually
        fid2  = f"wf-{uuid.uuid4()}"
        short = fid2[3:11]
        rel2  = f".flowctl/flows/{short}/state.json"
        dest2 = proj / rel2
        dest2.parent.mkdir(parents=True, exist_ok=True)
        tpl = json.loads(TEMPLATE.read_text(encoding="utf-8"))
        tpl["flow_id"] = fid2
        dest2.write_text(json.dumps(tpl, indent=2), encoding="utf-8")
        # Register fid2 in flows.json (without changing active)
        idx = json.loads((proj / ".flowctl" / "flows.json").read_text(encoding="utf-8"))
        idx["flows"][fid2] = {"state_file": rel2, "label": "second"}
        (proj / ".flowctl" / "flows.json").write_text(
            json.dumps(idx, indent=2) + "\n", encoding="utf-8"
        )

        resolved = _resolve(proj, active_flow=fid2)
        assert resolved["source"] == "flows_json", resolved
        assert resolved["state_file"].endswith(rel2), resolved

    def test_two_active_flows_resolve_to_distinct_files(self, tmp_path: Path) -> None:
        """TC-P02: two FLOWCTL_ACTIVE_FLOW values → two distinct state_file paths."""
        proj, fid_a = _make_flow_project(tmp_path / "proj", "project-a")
        fid_b       = _run_fork(proj, "fork-b")

        resolved_a = _resolve(proj, active_flow=fid_a)
        resolved_b = _resolve(proj, active_flow=fid_b)

        assert resolved_a["state_file"] != resolved_b["state_file"], (
            f"Both resolved to the same file: {resolved_a['state_file']}"
        )
        assert Path(resolved_a["state_file"]).is_file()
        assert Path(resolved_b["state_file"]).is_file()

    def test_no_flows_json_returns_not_initialized(self, tmp_path: Path) -> None:
        """TC-P03: no flows.json and no env → source=not_initialized, state_file empty."""
        fresh = tmp_path / "fresh"
        fresh.mkdir()
        resolved = _resolve(fresh)
        assert resolved["source"] == "not_initialized", resolved
        assert resolved["state_file"] == "", resolved


# ─────────────────────────────────────────────────────────────
# TC-P04 … TC-P06: lock hash properties
# ─────────────────────────────────────────────────────────────

class TestLockHash:
    def test_deterministic_per_path(self) -> None:
        """TC-P04: same path → same hash on repeated calls."""
        path = "/some/project/.flowctl/flows/abcdef12/state.json"
        assert _lock_hash(path) == _lock_hash(path)

    def test_distinct_paths_distinct_hashes(self, tmp_path: Path) -> None:
        """TC-P05: different state file paths → different lock hashes."""
        proj, fid_a = _make_flow_project(tmp_path / "proj", "project")
        fid_b       = _run_fork(tmp_path / "proj", "fork")

        sf_a = _resolve(tmp_path / "proj", active_flow=fid_a)["state_file"]
        sf_b = _resolve(tmp_path / "proj", active_flow=fid_b)["state_file"]

        assert sf_a != sf_b, "state files must differ"
        assert _lock_hash(sf_a) != _lock_hash(sf_b), (
            f"lock hash collision: both map to {_lock_hash(sf_a)}"
        )

    def test_same_path_idempotent_hash(self) -> None:
        """TC-P06: same state path always yields the same 16-char hex hash."""
        path  = "/project/.flowctl/flows/00112233/state.json"
        h1    = _lock_hash(path)
        h2    = _lock_hash(path)
        assert h1 == h2
        assert len(h1) == 16
        assert all(c in "0123456789abcdef" for c in h1)


# ─────────────────────────────────────────────────────────────
# TC-P07 … TC-P10: flowctl fork behavior
# ─────────────────────────────────────────────────────────────

class TestForkCommand:
    def test_5_concurrent_forks_unique_flow_ids(self, tmp_path: Path) -> None:
        """TC-P07: 5 concurrent forks → 5 unique flow_ids in flows.json."""
        proj, _ = _make_flow_project(tmp_path / "proj", "concurrent-project")

        def fork_once(i: int) -> str:
            return _run_fork(proj, f"parallel-task-{i}")

        with ThreadPoolExecutor(max_workers=5) as pool:
            fids = list(pool.map(fork_once, range(5)))

        assert len(set(fids)) == 5, f"Expected 5 unique flow_ids, got: {fids}"

        idx = json.loads((proj / ".flowctl" / "flows.json").read_text(encoding="utf-8"))
        for fid in fids:
            assert fid in idx["flows"], f"flow_id {fid} not registered in flows.json"

    def test_concurrent_forks_do_not_change_active_flow_id(self, tmp_path: Path) -> None:
        """TC-P08: active_flow_id in flows.json unchanged after multiple forks."""
        proj, orig_active = _make_flow_project(tmp_path / "proj", "stable-active")

        for i in range(3):
            _run_fork(proj, f"task-{i}")

        idx = json.loads((proj / ".flowctl" / "flows.json").read_text(encoding="utf-8"))
        assert idx["active_flow_id"] == orig_active, (
            f"active_flow_id changed from {orig_active!r} to {idx['active_flow_id']!r}"
        )

    def test_fork_state_file_valid_content(self, tmp_path: Path) -> None:
        """TC-P09: fork state file has valid JSON with required fields."""
        proj, _ = _make_flow_project(tmp_path / "proj", "valid-content-project")
        new_fid = _run_fork(proj, "content-check")

        idx = json.loads((proj / ".flowctl" / "flows.json").read_text(encoding="utf-8"))
        rel = idx["flows"][new_fid]["state_file"]
        sf  = proj / rel

        assert sf.is_file(), f"state file missing: {sf}"
        data = json.loads(sf.read_text(encoding="utf-8"))

        assert data["flow_id"] == new_fid
        assert data["flow_id"].startswith("wf-")
        assert data["overall_status"] == "in_progress"
        assert isinstance(data.get("steps"), dict)
        assert data.get("current_step") == 1

    def test_fork_eval_output_resolves_to_correct_state(self, tmp_path: Path) -> None:
        """TC-P10: FLOWCTL_ACTIVE_FLOW from fork eval → resolver returns correct state_file."""
        proj, _ = _make_flow_project(tmp_path / "proj", "resolve-check-project")
        new_fid = _run_fork(proj, "resolve-task")

        resolved = _resolve(proj, active_flow=new_fid)
        assert resolved["source"] == "flows_json", resolved
        assert Path(resolved["state_file"]).is_file(), (
            f"state file not found at: {resolved['state_file']}"
        )
        # The resolved file should belong to the new flow
        data = json.loads(Path(resolved["state_file"]).read_text(encoding="utf-8"))
        assert data["flow_id"] == new_fid

    def test_fork_label_stored_as_project_description(self, tmp_path: Path) -> None:
        """TC-P16: fork --label propagates to project_description in new state."""
        proj, _ = _make_flow_project(tmp_path / "proj", "label-test-project")
        new_fid = _run_fork(proj, "my-feature-branch")

        idx = json.loads((proj / ".flowctl" / "flows.json").read_text(encoding="utf-8"))
        sf  = proj / idx["flows"][new_fid]["state_file"]
        data = json.loads(sf.read_text(encoding="utf-8"))
        assert data.get("project_description") == "my-feature-branch", (
            f"project_description={data.get('project_description')!r}"
        )

    def test_fork_inherits_project_name_from_active_flow(self, tmp_path: Path) -> None:
        """TC-P17: fork picks up project_name from active flow's state file."""
        proj, _ = _make_flow_project(tmp_path / "proj", "inherited-name")
        new_fid = _run_fork(proj, "some-task")

        idx = json.loads((proj / ".flowctl" / "flows.json").read_text(encoding="utf-8"))
        sf  = proj / idx["flows"][new_fid]["state_file"]
        data = json.loads(sf.read_text(encoding="utf-8"))
        assert data.get("project_name") == "inherited-name", (
            f"project_name={data.get('project_name')!r}"
        )


# ─────────────────────────────────────────────────────────────
# TC-P11 … TC-P15: real lock contention (subprocess-level)
# ─────────────────────────────────────────────────────────────

# Minimal bash helper that sources lock.sh and tries to acquire a lock.
# Exits 0 on success, 1 on conflict.
_LOCK_HELPER = """\
#!/usr/bin/env bash
set -euo pipefail
LOCK_SH="$1"; LOCK_DIR="$2"; HOLD_SECS="${3:-0}"
YELLOW='' RED='' BOLD='' NC=''
source "$LOCK_SH"
WORKFLOW_LOCK_DIR="$LOCK_DIR"
wf_acquire_flow_lock
echo "ACQUIRED:$$"
sleep "$HOLD_SECS"
"""


def _spawn_lock_holder(lock_dir: Path, hold_secs: float = 1.0) -> subprocess.Popen:
    """Start a subprocess that acquires the lock and holds it for hold_secs."""
    env = {**os.environ, "WORKFLOW_LOCK_DIR": str(lock_dir),
           "YELLOW": "", "RED": "", "BOLD": "", "NC": ""}
    proc = subprocess.Popen(
        ["bash", str(LOCK_SH)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    return proc


def _try_acquire_lock(lock_dir: Path, timeout: float = 2.0) -> tuple[bool, str]:
    """Try to acquire lock_dir in a subprocess. Returns (success, output)."""
    script = (
        f"source {LOCK_SH}; "
        f"WORKFLOW_LOCK_DIR={lock_dir}; "
        "YELLOW='' RED='' BOLD='' NC=''; "
        "wf_acquire_flow_lock && echo ACQUIRED || echo FAILED"
    )
    try:
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True, text=True, timeout=timeout,
        )
        success = "ACQUIRED" in result.stdout
        return success, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"


class TestLockContention:
    def test_same_lock_dir_only_one_winner(self, tmp_path: Path) -> None:
        """TC-P11: while a holder keeps the lock, all challengers are denied.

        Strategy: start a "holder" subprocess that acquires the lock and holds it
        for 2 s (via sleep).  Then spawn 4 challenger subprocesses that each try
        to acquire the same lock with a 1 s timeout.  All challengers must fail,
        proving the mkdir-based lock is exclusive while the holder lives.
        """
        lock_dir = tmp_path / ".flowctl" / "locks" / "aaabbbcccdddeeee"
        lock_dir.parent.mkdir(parents=True, exist_ok=True)

        # Start a holder that acquires the lock and holds for 2 s
        holder_script = (
            f"WORKFLOW_LOCK_DIR={lock_dir}; "
            "YELLOW='' RED='' BOLD='' NC=''; "
            f"source {LOCK_SH}; "
            "wf_acquire_flow_lock && echo HOLDER_ACQUIRED && sleep 2"
        )
        holder = subprocess.Popen(
            ["bash", "-c", holder_script],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

        # Wait until holder has actually acquired (reads "HOLDER_ACQUIRED" from stdout)
        try:
            line = holder.stdout.readline()  # type: ignore[union-attr]
            assert b"HOLDER_ACQUIRED" in line, (
                f"Holder did not acquire lock: {line!r} stderr={holder.stderr.read()!r}"
            )
        finally:
            pass  # holder still running

        # 4 challengers, each with a short timeout — all must fail
        challenger_results: list[tuple[bool, str]] = []
        try:
            def try_challenger(_: int) -> tuple[bool, str]:
                return _try_acquire_lock(lock_dir, timeout=1.0)

            with ThreadPoolExecutor(max_workers=4) as pool:
                challenger_results = list(pool.map(try_challenger, range(4)))
        finally:
            holder.terminate()
            holder.wait(timeout=3)

        winners = [i for i, (ok, _) in enumerate(challenger_results) if ok]
        assert len(winners) == 0, (
            f"Expected 0 challengers to win while holder is alive, "
            f"but {len(winners)} acquired:\n"
            f"{[(ok, out[:120]) for ok, out in challenger_results]}"
        )

    def test_different_lock_dirs_no_contention(self, tmp_path: Path) -> None:
        """TC-P12: 5 processes each with their own lock_dir → all acquire."""
        N = 5
        lock_dirs = [
            tmp_path / ".flowctl" / "locks" / f"flow{i:016x}" for i in range(N)
        ]
        for d in lock_dirs:
            d.parent.mkdir(parents=True, exist_ok=True)

        def try_acquire_own(idx: int) -> tuple[int, bool, str]:
            ok, out = _try_acquire_lock(lock_dirs[idx])
            return idx, ok, out

        with ThreadPoolExecutor(max_workers=N) as pool:
            futs = [pool.submit(try_acquire_own, i) for i in range(N)]
            results = [fut.result() for fut in as_completed(futs)]

        winners = [idx for idx, ok, _ in results if ok]
        assert len(winners) == N, (
            f"Expected all {N} to acquire, only {len(winners)} did: "
            f"{[(idx, out) for idx, ok, out in results if not ok]}"
        )

    def test_stale_lock_pid_not_running_reclaimed(self, tmp_path: Path) -> None:
        """TC-P13: dead PID in lock_dir/pid → reclaimed on next acquire."""
        lock_dir = tmp_path / ".flowctl" / "locks" / "stalelock0000000"
        lock_dir.mkdir(parents=True)
        (lock_dir / "pid").write_text("99999999", encoding="utf-8")  # no such pid

        ok, out = _try_acquire_lock(lock_dir)
        assert ok, f"Stale lock NOT reclaimed: {out}"

    def test_lock_released_after_subprocess_exits(self, tmp_path: Path) -> None:
        """TC-P14: EXIT trap fires → lock_dir removed within 500ms of process exit."""
        lock_dir = tmp_path / ".flowctl" / "locks" / "exittraplocktest"
        lock_dir.parent.mkdir(parents=True, exist_ok=True)

        script = (
            f"WORKFLOW_LOCK_DIR={lock_dir}; "
            "YELLOW='' RED='' BOLD='' NC=''; "
            f"source {LOCK_SH}; "
            "wf_acquire_flow_lock; "
            "sleep 0.05"  # hold briefly then exit naturally
        )
        proc = subprocess.run(
            ["bash", "-c", script],
            capture_output=True, text=True, timeout=5,
        )
        assert proc.returncode == 0, f"lock subprocess failed: {proc.stderr}"

        # Allow a small window for the EXIT trap to clean up
        deadline = time.monotonic() + 0.5
        while time.monotonic() < deadline:
            if not lock_dir.exists():
                break
            time.sleep(0.05)

        assert not lock_dir.exists(), (
            f"Lock dir still exists {0.5:.1f}s after process exit: {lock_dir}"
        )

    def test_lock_hint_contains_flowctl_fork(self, tmp_path: Path) -> None:
        """TC-P15: _wf_lock_hint output mentions 'flowctl fork'."""
        script = (
            "YELLOW='' RED='' BOLD='' NC=''; "
            f"source {LOCK_SH}; "
            "_wf_lock_hint"
        )
        result = subprocess.run(
            ["bash", "-c", script],
            capture_output=True, text=True, timeout=5,
        )
        combined = result.stdout + result.stderr
        assert "flowctl fork" in combined, (
            f"Hint does not contain 'flowctl fork':\n{combined}"
        )
        assert "eval" in combined, (
            f"Hint does not contain 'eval':\n{combined}"
        )
