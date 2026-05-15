#!/usr/bin/env python3
"""
Merge flowctl MCP server definitions into .cursor/mcp.json.

- No file / empty: write template (scaffold or setup mode).
- --overwrite: replace entire mcpServers with template (other top-level keys dropped).
- Else: parse existing JSON; add only missing server keys from template; keep user servers.
- Invalid JSON: exit 2 (caller should warn and suggest --overwrite).

Prints to stdout:
  - MCP_STATUS=<created|overwritten|merged|unchanged|invalid_json|invalid_structure>
  - GLOBAL_MCP_STATUS=<created|merged|unchanged|skipped_*...> (merge into ~/.cursor/mcp.json)
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any


def _resolve_cmd(cmd: str) -> str:
    """Resolve a command to its absolute path so Cursor can find it regardless of PATH.

    Cursor spawns MCP servers with a restricted PATH (especially on macOS) that may
    not include npm global bin dirs like ~/.npm-global/bin or /usr/local/bin.
    Writing the absolute path avoids "command not found" failures at runtime.

    Preference order:
    1. ~/.asdf/shims/<cmd>  — always points to the currently active asdf version;
       safe across `asdf global <tool> <version>` switches (unlike the versioned
       absolute path that shutil.which captures at init time).
    2. shutil.which()       — fallback for non-asdf installs (nvm, homebrew, system).
    3. cmd as-is            — last resort; Cursor will fail at runtime if PATH is wrong.
    """
    import os
    asdf_shim = os.path.expanduser(f"~/.asdf/shims/{cmd}")
    if os.path.isfile(asdf_shim) and os.access(asdf_shim, os.X_OK):
        return asdf_shim
    return shutil.which(cmd) or cmd


def scaffold_template(workflow_cli: str) -> dict[str, Any]:
    # Resolve to absolute path at init-time so Cursor can start the MCP server
    # even when its restricted PATH doesn't include npm global bin dirs.
    abs_cmd = _resolve_cmd(workflow_cli)
    return {
        "shell-proxy": {
            "command": abs_cmd,
            "args": ["mcp", "--shell-proxy"],
            "env": {"FLOWCTL_PROJECT_ROOT": "${workspaceFolder}"},
            "description": (
                "Token-efficient shell proxy — wf_state, wf_git, wf_step_context, "
                "wf_files, wf_read, wf_env. Replaces bash reads with structured cached JSON. "
                "Use BEFORE any bash command."
            ),
        },
        "flowctl-state": {
            "command": abs_cmd,
            "args": ["mcp", "--workflow-state"],
            "env": {"FLOWCTL_PROJECT_ROOT": "${workspaceFolder}"},
            "description": (
                "Workflow state tracker — flow_get_state, flow_advance_step, "
                "flow_request_approval, flow_add_blocker, flow_add_decision"
            ),
        },
    }


def setup_template() -> dict[str, Any]:
    # NOTE: Graphify does NOT have an MCP server. It is used directly via:
    #   python3 -m graphify update .   → builds graphify-out/graph.json
    #   agents read graphify-out/graph.json + GRAPH_REPORT.md directly.
    #
    # GitNexus: always included in template. If `npx gitnexus` is not installed,
    # Cursor shows it as a failed server but does NOT block shell-proxy or flowctl-state.
    # Install manually: npm install -g gitnexus (then `flowctl init --overwrite`).
    flowctl_cmd = _resolve_cmd("flowctl")
    npx_cmd     = shutil.which("npx") or "npx"
    return {
        "gitnexus": {
            "command": npx_cmd,
            "args": ["gitnexus", "mcp"],
            "env": {"GITNEXUS_AUTO_INDEX": "true"},
            "description": (
                "Git intelligence — smart commits, branch naming, PR descriptions. "
                "Install: npm install -g gitnexus"
            ),
        },
        "flowctl-state": {
            "command": flowctl_cmd,
            "args": ["mcp", "--workflow-state"],
            "env": {"FLOWCTL_PROJECT_ROOT": "${workspaceFolder}"},
            "description": "Workflow state tracker — current step, approvals, blockers",
        },
        "shell-proxy": {
            "command": flowctl_cmd,
            "args": ["mcp", "--shell-proxy"],
            "env": {"FLOWCTL_PROJECT_ROOT": "${workspaceFolder}"},
            "description": (
                "Token-efficient shell proxy — wf_state, wf_git, wf_step_context, "
                "wf_files, wf_read, wf_env"
            ),
        },
    }


def write_mcp(path: Path, servers: dict[str, Any], *, keep_extra_top: bool, extra_top: dict[str, Any]) -> None:
    out: dict[str, Any] = dict(extra_top) if keep_extra_top else {}
    out["mcpServers"] = servers
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(out, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")


def _merge_into(path: Path, template: dict[str, Any], overwrite: bool) -> str:
    """Merge template into a single mcp.json file. Returns status string."""
    had_file = path.is_file() and path.stat().st_size > 0

    if overwrite:
        write_mcp(path, dict(template), keep_extra_top=False, extra_top={})
        return "overwritten" if had_file else "created"

    if not had_file:
        write_mcp(path, dict(template), keep_extra_top=False, extra_top={})
        return "created"

    raw = path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid_json:{e.lineno}") from e

    if not isinstance(data, dict):
        raise ValueError("invalid_structure")

    extra_top = {k: v for k, v in data.items() if k != "mcpServers"}
    servers = data.get("mcpServers")

    if servers is None:
        write_mcp(path, dict(template), keep_extra_top=True, extra_top=extra_top)
        return "merged"

    if not isinstance(servers, dict):
        raise ValueError("invalid_structure")

    merged = dict(servers)
    added = [name for name, spec in template.items() if name not in merged and not merged.update({name: spec})]  # type: ignore[func-returns-value]
    write_mcp(path, merged, keep_extra_top=True, extra_top=extra_top)
    return "merged" if added else "unchanged"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("path", type=Path, help=".cursor/mcp.json path")
    ap.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace mcpServers entirely with the template for this mode.",
    )
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--scaffold", metavar="WORKFLOW_CLI", help="Minimal flowctl MCP entries")
    g.add_argument("--setup", action="store_true", help="Full setup template (graphify + gitnexus + flowctl)")
    args = ap.parse_args()

    path: Path = args.path
    template = setup_template() if args.setup else scaffold_template(args.scaffold)

    # ── Project-level .cursor/mcp.json ───────────────────────────────────────
    had_file = path.is_file() and path.stat().st_size > 0

    if args.overwrite:
        write_mcp(path, dict(template), keep_extra_top=False, extra_top={})
        print("MCP_STATUS=" + ("overwritten" if had_file else "created"))
        # Fall through to global merge below
    elif not had_file:
        write_mcp(path, dict(template), keep_extra_top=False, extra_top={})
        print("MCP_STATUS=created")
    else:
        raw = path.read_text(encoding="utf-8")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            print(
                f".cursor/mcp.json không phải JSON hợp lệ ({e.msg} tại dòng {e.lineno}). "
                f"Sửa file hoặc chạy: flowctl init --overwrite ...",
                file=sys.stderr,
            )
            print("MCP_STATUS=invalid_json")
            return 2

        if not isinstance(data, dict):
            print("Gốc JSON phải là object {...}. Dùng --overwrite để thay thế.", file=sys.stderr)
            print("MCP_STATUS=invalid_structure")
            return 2

        extra_top = {k: v for k, v in data.items() if k != "mcpServers"}
        servers = data.get("mcpServers")

        if servers is None:
            merged = dict(template)
            write_mcp(path, merged, keep_extra_top=True, extra_top=extra_top)
            print("MCP_STATUS=merged")
        elif not isinstance(servers, dict):
            print(
                "Trường mcpServers không phải object. Sửa tay hoặc dùng flowctl init --overwrite.",
                file=sys.stderr,
            )
            print("MCP_STATUS=invalid_structure")
            return 2
        else:
            merged = dict(servers)
            added: list[str] = []
            for name, spec in template.items():
                if name not in merged:
                    merged[name] = spec
                    added.append(name)
            write_mcp(path, merged, keep_extra_top=True, extra_top=extra_top)
            print("MCP_STATUS=" + ("merged" if added else "unchanged"))

    # ── Global ~/.cursor/mcp.json (always — no manual activation needed) ────────
    import os
    global_path = Path(os.path.expanduser("~/.cursor/mcp.json"))
    try:
        g_status = _merge_into(global_path, template, overwrite=False)
        print(f"GLOBAL_MCP_STATUS={g_status}")
    except ValueError as exc:
        code = str(exc)
        if code.startswith("invalid_json"):
            print(f"GLOBAL_MCP_STATUS=skipped_invalid_json", file=sys.stderr)
        else:
            print(f"GLOBAL_MCP_STATUS=skipped_{code}", file=sys.stderr)
    except OSError as exc:
        print(f"GLOBAL_MCP_STATUS=skipped_permission_denied ({exc})", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
