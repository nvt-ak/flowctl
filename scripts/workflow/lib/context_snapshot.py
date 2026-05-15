#!/usr/bin/env python3
"""Build a compact Context Snapshot markdown from workflow state JSON (flows-first path or legacy root)."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path


def build_snapshot(state_path: Path, step: str, repo_root: Path) -> str:
    data = json.loads(state_path.read_text(encoding="utf-8"))
    step = str(step or data.get("current_step", "1"))
    steps = data.get("steps") or {}
    s = steps.get(step, {})
    step_name = s.get("name", "")
    status = s.get("status", "")
    primary = s.get("agent", "")
    supports = [a for a in s.get("support_agents", []) if a and a != primary]
    dr = s.get("dispatch_risk") or {}
    dispatch_root = Path(
        os.environ.get("WF_DISPATCH_BASE") or (repo_root / "workflows" / "dispatch")
    )
    digest_path = dispatch_root / f"step-{step}" / "context-digest.md"
    digest_note = (
        f"`{digest_path.relative_to(repo_root)}` (exists — skim War Room / prior context)"
        if digest_path.is_file()
        else f"`{digest_path.relative_to(repo_root)}` (not created yet)"
    )

    decisions = s.get("decisions") or []
    recent = decisions[-8:] if isinstance(decisions, list) else []
    dec_lines = []
    for d in recent:
        if isinstance(d, dict):
            dec_lines.append(
                f"- ({d.get('date', '')}) {d.get('description', '')[:200]}"
            )
        else:
            dec_lines.append(f"- {str(d)[:200]}")
    if not dec_lines:
        dec_lines.append("- (none recorded on this step)")

    open_blockers: list[str] = []
    skipped_steps: list[str] = []
    for sn, sobj in sorted(steps.items(), key=lambda x: int(x[0]) if str(x[0]).isdigit() else 0):
        for b in sobj.get("blockers") or []:
            if isinstance(b, dict) and not b.get("resolved"):
                desc = (b.get("description") or "")[:160]
                open_blockers.append(f"- Step {sn}: {desc}")
        if sobj.get("status") == "skipped":
            sname = sobj.get("name", "")
            sreason = sobj.get("skip_reason", "")
            skipped_steps.append(f"- Step {sn} ({sname}): {sreason}" if sreason else f"- Step {sn} ({sname})")
    if not open_blockers:
        open_blockers.append("- (none)")

    risk_bits = []
    if dr.get("high_risk"):
        risk_bits.append("high_risk=true")
    im = dr.get("impacted_modules")
    if isinstance(im, int):
        risk_bits.append(f"impacted_modules={im}")
    dc = dr.get("dispatch_count")
    if isinstance(dc, int):
        risk_bits.append(f"dispatch_count={dc}")
    risk_line = ", ".join(risk_bits) if risk_bits else "(defaults — no PM risk flags set)"

    skipped_section = (
        "\n### Skipped steps (why they were skipped)\n" + "\n".join(skipped_steps) + "\n"
        if skipped_steps else ""
    )

    return f"""## Context Snapshot (Step {step}: {step_name})

_Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} — compile-once; use `wf_step_context()` only if you need newer state than this block._

| Field | Value |
|-------|-------|
| Project | {data.get("project_name", "")} |
| Step | {step} |
| Status | {status} |
| Primary | `{primary}` |
| Support | {", ".join(f"`{x}`" for x in supports) or "(none)"} |
| dispatch_risk | {risk_line} |
{skipped_section}
### Recent decisions (this step, last up to 8)
{chr(10).join(dec_lines)}

### Open blockers (all steps)
{chr(10).join(open_blockers[:15])}

### Context digest path
{digest_note}

> **When to call `wf_step_context()`**: after edits to workflow state (`.flowctl/flows/.../state.json` or `FLOWCTL_STATE_FILE`), new blockers/decisions, or if this snapshot is stale. Otherwise prefer this block + code layers below.
"""


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: context_snapshot.py <state.json> <step> [repo_root]", file=sys.stderr)
        sys.exit(2)
    state_path = Path(sys.argv[1])
    step = sys.argv[2]
    repo_root = Path(sys.argv[3]) if len(sys.argv) > 3 else state_path.parent
    sys.stdout.write(build_snapshot(state_path, step, repo_root))


if __name__ == "__main__":
    main()
