"""
TC-10: monitor-web.py resilience tests
- load_stats / load_events / load_flow_state with corrupt / missing / non-UTF8 files
- build_project_data graceful degradation
- session_duration with bad timestamps
"""
import json
import sys
import textwrap
import subprocess
from pathlib import Path

import pytest

MONITOR_WEB = Path(__file__).resolve().parent.parent / "scripts" / "monitor-web.py"

# Import functions directly (skip __main__ guard)
sys.path.insert(0, str(MONITOR_WEB.parent))


def _import_monitor():
    """Import monitor-web as a module (it has no __all__ but functions are top-level)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("monitor_web", MONITOR_WEB)
    mod = importlib.util.module_from_spec(spec)
    # Patch sys.argv to avoid argparse in __main__
    import unittest.mock as mock
    with mock.patch("sys.argv", ["monitor-web.py", "--once"]):
        try:
            spec.loader.exec_module(mod)
        except SystemExit:
            pass  # --once causes exit after printing JSON
    return mod


@pytest.fixture(scope="module")
def mw():
    return _import_monitor()


class TestLoadStats:
    def test_missing_file_returns_empty_dict(self, mw, tmp_path, monkeypatch):
        monkeypatch.setattr(mw, "STATS_F", tmp_path / "nonexistent.json")
        assert mw.load_stats() == {}

    def test_corrupt_json_returns_empty_dict(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "stats.json"
        f.write_text("{not valid json", encoding="utf-8")
        monkeypatch.setattr(mw, "STATS_F", f)
        assert mw.load_stats() == {}

    def test_empty_file_returns_empty_dict(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "stats.json"
        f.write_text("", encoding="utf-8")
        monkeypatch.setattr(mw, "STATS_F", f)
        assert mw.load_stats() == {}

    def test_valid_stats_loaded_correctly(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "stats.json"
        data = {"total_consumed_tokens": 1000, "total_saved_tokens": 500}
        f.write_text(json.dumps(data), encoding="utf-8")
        monkeypatch.setattr(mw, "STATS_F", f)
        result = mw.load_stats()
        assert result["total_consumed_tokens"] == 1000


class TestLoadEvents:
    def test_missing_file_returns_empty_list(self, mw, tmp_path, monkeypatch):
        monkeypatch.setattr(mw, "EVENTS_F", tmp_path / "nonexistent.jsonl")
        assert mw.load_events() == []

    def test_corrupt_lines_skipped_silently(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "events.jsonl"
        f.write_text(
            '{"type":"mcp","tool":"wf_state"}\n'
            'NOT JSON AT ALL\n'
            '{"type":"bash","cmd":"ls"}\n',
            encoding="utf-8"
        )
        monkeypatch.setattr(mw, "EVENTS_F", f)
        events = mw.load_events()
        assert len(events) == 2
        assert all(isinstance(e, dict) for e in events)

    def test_all_corrupt_returns_empty_list(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "events.jsonl"
        f.write_text("garbage\nmore garbage\n{broken", encoding="utf-8")
        monkeypatch.setattr(mw, "EVENTS_F", f)
        assert mw.load_events() == []

    def test_empty_file_returns_empty_list(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "events.jsonl"
        f.write_text("", encoding="utf-8")
        monkeypatch.setattr(mw, "EVENTS_F", f)
        assert mw.load_events() == []


class TestLoadFlowState:
    def test_missing_file_returns_empty_dict(self, mw, tmp_path, monkeypatch):
        monkeypatch.setattr(mw, "STATE_F", tmp_path / "nonexistent.json")
        assert mw.load_flow_state() == {}

    def test_corrupt_json_returns_empty_dict(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "state.json"
        f.write_text("{bad json", encoding="utf-8")
        monkeypatch.setattr(mw, "STATE_F", f)
        assert mw.load_flow_state() == {}

    def test_valid_state_loaded_correctly(self, mw, tmp_path, monkeypatch):
        f = tmp_path / "state.json"
        f.write_text(json.dumps({"current_step": 3, "project_name": "Test"}),
                     encoding="utf-8")
        monkeypatch.setattr(mw, "STATE_F", f)
        result = mw.load_flow_state()
        assert result["current_step"] == 3


class TestSessionDuration:
    def test_missing_session_start_returns_placeholder(self, mw):
        assert mw.session_duration({}) == "--:--:--"

    def test_invalid_timestamp_returns_placeholder(self, mw):
        assert mw.session_duration({"session_start": "not-a-date"}) == "--:--:--"

    def test_none_session_start_returns_placeholder(self, mw):
        assert mw.session_duration({"session_start": None}) == "--:--:--"

    def test_valid_timestamp_returns_hh_mm_ss(self, mw):
        from datetime import datetime, timezone, timedelta
        start = (datetime.now(timezone.utc) - timedelta(hours=1, minutes=23, seconds=45))
        result = mw.session_duration({"session_start": start.isoformat()})
        assert ":" in result
        assert result != "--:--:--"


class TestBuildProjectData:
    def test_missing_cache_dir_returns_degraded_data(self, mw, tmp_path):
        result = mw.build_project_data(
            str(tmp_path / "nonexistent"),
            str(tmp_path / "state.json")
        )
        # Must not raise — returns dict with zero-value metrics
        assert isinstance(result, dict)

    def test_corrupt_stats_file_degrades_gracefully(self, mw, tmp_path):
        cache = tmp_path / "cache"
        cache.mkdir()
        (cache / "session-stats.json").write_text("{broken", encoding="utf-8")
        result = mw.build_project_data(str(cache), str(tmp_path / "state.json"))
        assert isinstance(result, dict)

    def test_corrupt_state_file_degrades_gracefully(self, mw, tmp_path):
        cache = tmp_path / "cache"
        cache.mkdir()
        state = tmp_path / "state.json"
        state.write_text("{broken", encoding="utf-8")
        result = mw.build_project_data(str(cache), str(state))
        assert isinstance(result, dict)
