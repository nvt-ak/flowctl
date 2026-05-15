#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def extract_text(payload: dict) -> str:
    # Best effort extraction across possible stream-json shapes.
    for key in ("text", "delta", "content", "message"):
        val = payload.get(key)
        if isinstance(val, str) and val:
            return val
    if isinstance(payload.get("data"), dict):
        data = payload["data"]
        for key in ("text", "delta", "content", "message"):
            val = data.get(key)
            if isinstance(val, str) and val:
                return val
    return ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", required=True)
    parser.add_argument("--role", required=True)
    parser.add_argument("--flowctl-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--log-path", required=True)
    parser.add_argument("--heartbeats-path", required=True)
    args = parser.parse_args()

    log_path = Path(args.log_path)
    hb_path = Path(args.heartbeats_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    hb_path.parent.mkdir(parents=True, exist_ok=True)

    with log_path.open("a", encoding="utf-8") as logf, hb_path.open("a", encoding="utf-8") as hbf:
        for raw in sys.stdin:
            line = raw.rstrip("\n")
            ts = utc_now()
            parsed = None
            try:
                _raw = json.loads(line)
                # Only dict events are meaningful; scalars (NaN, true, 42…)
                # are treated as non-JSON text (written to log only).
                parsed = _raw if isinstance(_raw, dict) else None
            except (json.JSONDecodeError, ValueError):
                parsed = None

            if parsed is None:
                # Non-json line: keep in text log only.
                if line:
                    logf.write(line + "\n")
                    logf.flush()
                continue

            event_type = (
                parsed.get("type")
                or parsed.get("event")
                or parsed.get("kind")
                or "unknown"
            )
            text = extract_text(parsed)
            heartbeat = {
                "timestamp": ts,
                "flow_id": args.flowctl_id,
                "run_id": args.run_id,
                "correlation_id": f"{args.flowctl_id}/{args.run_id}/{args.step}/{args.role}",
                "step": int(args.step),
                "role": args.role,
                "event_type": str(event_type),
                "has_text": bool(text),
            }
            hbf.write(json.dumps(heartbeat, ensure_ascii=False) + "\n")
            hbf.flush()

            if text:
                logf.write(text)
                if not text.endswith("\n"):
                    logf.write("\n")
                logf.flush()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
