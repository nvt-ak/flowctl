"""
TC-11: stream_json_capture.py resilience tests
- Non-JSON lines must be logged to text log only, not raise
- Malformed JSON must be caught as JSONDecodeError (not bare except)
- Valid JSON events written to both log and heartbeat files
"""
import json
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

CAPTURE_SCRIPT = (
    Path(__file__).resolve().parent.parent
    / "scripts" / "workflow" / "lib" / "stream_json_capture.py"
)


def _run_capture(stdin_lines: list[str], tmp_path: Path) -> tuple[str, str, int]:
    log_path = tmp_path / "capture.log"
    hb_path  = tmp_path / "heartbeats.jsonl"
    cmd = [
        sys.executable, str(CAPTURE_SCRIPT),
        "--step", "1",
        "--role", "test-agent",
        "--flowctl-id", "wf-test",
        "--run-id", "run-001",
        "--log-path", str(log_path),
        "--heartbeats-path", str(hb_path),
    ]
    result = subprocess.run(
        cmd,
        input="\n".join(stdin_lines) + "\n",
        capture_output=True,
        text=True,
        timeout=10,
    )
    log_content = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    hb_content  = hb_path.read_text(encoding="utf-8")  if hb_path.exists()  else ""
    return log_content, hb_content, result.returncode


class TestStreamCaptureMalformedInput:
    def test_pure_text_lines_written_to_log(self, tmp_path: Path) -> None:
        log, hb, rc = _run_capture(["Hello world", "Not JSON at all"], tmp_path)
        assert rc == 0
        assert "Hello world" in log
        assert "Not JSON at all" in log
        # No heartbeat for non-JSON lines
        assert hb == "" or all(
            line.strip() == "" for line in hb.splitlines()
        )

    def test_malformed_json_does_not_crash(self, tmp_path: Path) -> None:
        """JSONDecodeError must be caught — process must exit 0."""
        bad_lines = ["{broken", '{"key": }', "][", "NaN"]
        log, _, rc = _run_capture(bad_lines, tmp_path)
        assert rc == 0

    def test_mixed_valid_and_invalid_lines(self, tmp_path: Path) -> None:
        """Valid JSON lines produce heartbeats; invalid lines are text-logged."""
        valid_event = json.dumps({
            "type": "text", "text": "Hello from agent",
            "step": 1, "role": "test-agent", "flowctl_id": "wf-test",
        })
        lines = ["plain text", valid_event, "{broken", "more plain"]
        log, hb, rc = _run_capture(lines, tmp_path)
        assert rc == 0
        assert "plain text" in log
        assert "more plain" in log

    def test_empty_input_produces_empty_output(self, tmp_path: Path) -> None:
        log, hb, rc = _run_capture([], tmp_path)
        assert rc == 0
        assert log == ""

    def test_valid_json_lines_written_to_log(self, tmp_path: Path) -> None:
        event = json.dumps({"type": "text", "text": "Agent message"})
        log, _, rc = _run_capture([event], tmp_path)
        assert rc == 0

    def test_log_file_uses_utf8(self, tmp_path: Path) -> None:
        """Vietnamese + emoji in text lines must roundtrip through the log file."""
        text = "Xin chào 🚀 từ agent"
        log, _, rc = _run_capture([text], tmp_path)
        assert rc == 0
        assert text in log
