#!/usr/bin/env python3
"""
Generate per-step token report after approve/collect.
Usage: python3 scripts/hooks/generate-token-report.py --step N
"""

import json, sys, argparse, os
from pathlib import Path
from datetime import datetime

_scripts = Path(__file__).resolve().parent.parent
if str(_scripts) not in sys.path:
    sys.path.insert(0, str(_scripts))
from lib.state_resolver import resolve_state_file  # noqa: E402

REPO      = Path(__file__).resolve().parent.parent.parent
# v1.1+: runtime data lives in FLOWCTL_CACHE_DIR (~/.flowctl/projects/*/cache/).
# Fallback to legacy .cache/mcp/ for pre-v1.1 projects.
_cache_default = str(REPO / ".cache" / "mcp")
CACHE     = Path(os.environ.get("FLOWCTL_CACHE_DIR", _cache_default))
EVENTS_F  = Path(os.environ.get("FLOWCTL_EVENTS_F",  str(CACHE / "events.jsonl")))
STATS_F   = Path(os.environ.get("FLOWCTL_STATS_F",   str(CACHE / "session-stats.json")))
if os.environ.get("FLOWCTL_STATE_FILE"):
    STATE_F = Path(os.environ["FLOWCTL_STATE_FILE"])
else:
    _resolved = resolve_state_file(REPO)
    STATE_F = _resolved if _resolved is not None else (REPO / "flowctl-state.json")

PRICE = {"input": 3.0, "output": 15.0}


def resolve_dispatch_base(repo: Path) -> Path:
    """Match scripts/workflow/lib/config.sh DISPATCH_BASE (per-flow vs legacy flat)."""
    env = os.environ.get("WF_DISPATCH_BASE")
    if env:
        return Path(env)
    try:
        raw = STATE_F.read_text(encoding="utf-8")
        d = json.loads(raw) if raw.strip() else {}
        fid = (d.get("flow_id") or "").strip()
        if len(fid) >= 11 and fid.startswith("wf-"):
            short = fid[3:11]
            return repo / "workflows" / short / "dispatch"
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return repo / "workflows" / "dispatch"

def load_events():
    if not EVENTS_F.exists(): return []
    lines = EVENTS_F.read_text(encoding="utf-8").strip().split("\n")
    events = []
    for l in lines:
        try:
            events.append(json.loads(l))
        except (json.JSONDecodeError, ValueError):
            pass
    return events

def load_stats():
    if not STATS_F.exists(): return {}
    try:
        return json.loads(STATS_F.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", type=int)
    args = parser.parse_args()

    state = {}
    try:
        state = json.loads(STATE_F.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, FileNotFoundError):
        pass

    step = args.step or state.get("current_step", 0)
    # After approve, current_step has advanced — use step-1 unless explicitly given
    if not args.step and step > 1:
        step = step - 1

    step_name = (state.get("steps", {}).get(str(step), {}) or {}).get("name", f"Step {step}")
    events    = load_events()
    stats     = load_stats()

    # Per-tool breakdown from session stats
    tools = stats.get("tools", {})
    consumed  = stats.get("total_consumed_tokens", 0)
    saved     = stats.get("total_saved_tokens", 0)
    cost_usd  = stats.get("total_cost_usd", 0)
    saved_usd = stats.get("total_saved_usd", 0)
    waste_tok = stats.get("bash_waste_tokens", 0)
    eff       = saved / (consumed + saved) * 100 if (consumed + saved) else 0

    # Top wasteful bash commands
    bash_waste = [(e.get("cmd",""), e.get("waste_tokens",0), e.get("suggestion",""))
                  for e in events if e.get("type") == "bash" and e.get("waste_tokens", 0) > 0]
    bash_waste.sort(key=lambda x: -x[1])

    # Low hit rate tools
    low_hit = [(n, t.get("hits",0)/t.get("calls",1), t.get("calls",0))
               for n, t in tools.items() if t.get("calls",0) >= 3 and t.get("hits",0)/t.get("calls",1) < 0.7]

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        f"# Token Report — Step {step}: {step_name}",
        f"Generated: {now}",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Total consumed (est.) | ~{consumed:,} tokens |",
        f"| Total saved (est.)    | ~{saved:,} tokens |",
        f"| Efficiency            | {eff:.0f}% |",
        f"| Cost (est.)           | ${cost_usd:.4f} |",
        f"| Saved cost (est.)     | ${saved_usd:.4f} |",
        f"| Bash waste            | ~{waste_tok:,} tokens |",
        "",
        "## Per-Tool Cache Performance",
        "",
        "| Tool | Calls | Hit Rate | Tokens Saved |",
        "|------|-------|----------|-------------|",
    ]
    for name, t in sorted(tools.items(), key=lambda x: -x[1].get("saved",0)):
        calls = t.get("calls", 0)
        rate  = t.get("hits", 0) / calls if calls else 0
        sv    = t.get("saved", 0)
        flag  = " ⚠️" if rate < 0.7 and calls >= 3 else ""
        lines.append(f"| `{name}` | {calls} | {rate:.0%}{flag} | ~{sv:,} |")

    if bash_waste:
        lines += ["", "## Top Token Waste (bash instead of MCP)", ""]
        seen = {}
        for cmd, waste, suggestion in bash_waste[:8]:
            key = cmd[:40]
            if key in seen:
                seen[key]["count"] += 1
                seen[key]["waste"] += waste
                continue
            seen[key] = {"cmd": cmd, "waste": waste, "suggestion": suggestion, "count": 1}
        for v in sorted(seen.values(), key=lambda x: -x["waste"])[:5]:
            times = f" ×{v['count']}" if v["count"] > 1 else ""
            lines.append(f"- `{v['cmd'][:60]}`{times} → **~{v['waste']:,} tokens wasted**")
            if v["suggestion"]:
                lines.append(f"  → Use `{v['suggestion']}` instead")

    if low_hit:
        lines += ["", "## Low Cache Hit Rate (needs investigation)", ""]
        for name, rate, calls in low_hit:
            lines.append(f"- `{name}`: {rate:.0%} hit rate over {calls} calls — check invalidation strategy")

    lines += [
        "",
        "## Recommendations",
        "",
        "- Run `wf_set_agent(agent_id)` at start of each agent session for attribution",
        "- Replace all `cat`, `git log`, `ls` with MCP tools",
        "- Check low hit rate tools — may need TTL adjustment",
    ]

    report_path = resolve_dispatch_base(REPO) / f"step-{step}" / "token-report.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Safe relative path display — fallback when report_path crosses drive boundaries (Windows)
    try:
        display = report_path.relative_to(REPO)
    except ValueError:
        try:
            display = os.path.relpath(str(report_path), str(REPO))
        except ValueError:
            display = str(report_path)
    print(f"Token report: {display}")

    # Archive and reset session stats for next step
    if STATS_F.exists():
        try:
            old = json.loads(STATS_F.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            old = {}
        archive = CACHE / f"session-stats-step{step}.json"
        archive.write_text(json.dumps(old, indent=2), encoding="utf-8")
        STATS_F.write_text(json.dumps({
            "session_start": datetime.utcnow().isoformat() + "Z",
            "previous_step": step,
        }, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
