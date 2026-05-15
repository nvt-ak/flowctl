#!/usr/bin/env python3
"""
PostToolUse hook — Detect expensive bash commands, log as waste events.
Receives JSON on stdin from Claude Code hooks system.

Architecture note:
  This hook is the DETECTION layer (fires after bash runs, logs waste).
  shell-proxy.js is the PREVENTION layer (agents call wf_* tools instead of bash).
  Together they give full visibility: proxy tracks savings, hook tracks leakage.
"""

import json, sys, re, os
from pathlib import Path
from datetime import datetime

_scripts = Path(__file__).resolve().parent.parent
if str(_scripts) not in sys.path:
    sys.path.insert(0, str(_scripts))
from lib.state_resolver import resolve_state_file  # noqa: E402

# Claude Code runs hooks with cwd = project root; FLOWCTL_PROJECT_ROOT overrides for manual use
REPO = Path(os.environ.get('FLOWCTL_PROJECT_ROOT', os.getcwd()))

def _resolve_cache_dir() -> Path:
    """Mirror resolveProjectCacheDir() in shell-proxy.js:
    1. FLOWCTL_CACHE_DIR env var (set by flowctl.sh when run via CLI)
    2. meta.json cache_dir matching REPO path under FLOWCTL_HOME/projects/
    3. Legacy fallback: REPO/.cache/mcp
    """
    if os.environ.get('FLOWCTL_CACHE_DIR'):
        return Path(os.environ['FLOWCTL_CACHE_DIR'])

    # Resolve FLOWCTL_HOME: env var → REPO/.flowctl-local → REPO/.flowctl → ~/.flowctl
    raw_home = os.environ.get('FLOWCTL_HOME', '')
    if raw_home:
        flowctl_home = Path(raw_home)
    else:
        flowctl_home = None
        for candidate in ['.flowctl-local', '.flowctl']:
            p = REPO / candidate
            if (p / 'projects').exists():
                flowctl_home = p
                break
        if flowctl_home is None:
            flowctl_home = Path.home() / '.flowctl'

    projects_dir = flowctl_home / 'projects'
    if projects_dir.exists():
        try:
            repo_resolved = str(REPO.resolve())
            for entry in projects_dir.iterdir():
                meta_f = entry / 'meta.json'
                if not meta_f.exists():
                    continue
                meta = json.loads(meta_f.read_text(encoding='utf-8'))
                if str(Path(meta.get('path', '')).resolve()) == repo_resolved and meta.get('cache_dir'):
                    return Path(meta['cache_dir'])
        except Exception:
            pass

    return REPO / '.cache' / 'mcp'

_cache_dir = _resolve_cache_dir()
EVENTS  = Path(os.environ.get('FLOWCTL_EVENTS_F', str(_cache_dir / "events.jsonl")))
STATS_F = Path(os.environ.get('FLOWCTL_STATS_F',  str(_cache_dir / "session-stats.json")))

def _read_project_identity() -> tuple:
    state_f = resolve_state_file(REPO)
    if state_f is None:
        legacy = REPO / "flowctl-state.json"
        state_f = legacy if legacy.is_file() else None
    if state_f is None or not state_f.is_file():
        return "", REPO.name
    try:
        s = json.loads(state_f.read_text(encoding="utf-8"))
        return s.get("flow_id", ""), s.get("project_name", REPO.name)
    except Exception:
        return "", REPO.name

_PROJECT_ID, _PROJECT_NAME = _read_project_identity()

# (pattern, mcp_alternative, mcp_alt_tokens)
# mcp_alt_tokens = expected token cost of the MCP tool output.
# Must stay in sync with BASH_EQUIV in scripts/workflow/mcp/shell-proxy.js:
#   bash_equiv is what bash costs; mcp_alt_tokens is what MCP costs.
#   waste = output_tokens - mcp_alt_tokens
WASTEFUL_PATTERNS = [
    (r"git\s+log",                           "wf_git()",        110),
    (r"git\s+status",                        "wf_git()",        110),
    (r"git\s+diff",                          "wf_git()",        110),
    (r"git\s+branch",                        "wf_git()",        110),
    (r"cat\s+flowctl-state",                 "wf_state()",       95),
    (r"cat\s+.*\.json",                      "wf_read(path)",   400),
    (r"ls\s+-la?",                           "wf_files()",       90),
    (r"find\s+\.",                           "wf_files()",       90),
    (r"wc\s+-l",                             "wf_read(path)",   400),
    (r"python3.*flowctl-state",              "wf_state()",       95),
    (r"bash\s+scripts/flowctl\.sh\s+status", "wf_state()",       95),
]

def estimate_tokens(text: str) -> int:
    if not text: return 0
    chars = len(text)
    quotes = text.count('"')
    non_ascii = sum(1 for c in text if ord(c) > 127)
    json_ratio = quotes / max(chars, 1)
    viet_ratio = non_ascii / max(chars, 1)
    if json_ratio > 0.05: return chars // 3
    if viet_ratio > 0.15: return chars // 2
    return chars // 4

def ensure_cache():
    EVENTS.parent.mkdir(parents=True, exist_ok=True)

def log_event(event):
    ensure_cache()
    event["ts"]           = datetime.utcnow().isoformat() + "Z"
    event["project_id"]   = _PROJECT_ID
    event["project_name"] = _PROJECT_NAME
    with open(EVENTS, "a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")
    update_stats(event)

def update_stats(event):
    stats = {}
    try:
        if STATS_F.exists():
            stats = json.loads(STATS_F.read_text(encoding="utf-8"))
    except Exception:
        pass
    stats["bash_waste_tokens"] = stats.get("bash_waste_tokens", 0) + event.get("waste_tokens", 0)
    stats["bash_calls"]        = stats.get("bash_calls", 0) + 1
    try:
        STATS_F.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    except Exception:
        pass

def _check_wasteful(command: str) -> tuple:
    """Returns (suggestion, mcp_alt_tokens) or (None, 0) if not wasteful."""
    for pattern, alt, mcp_tok in WASTEFUL_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return alt, mcp_tok
    return None, 0


def handle_claude_code(data: dict) -> None:
    """Claude Code PostToolUse format:
    {"tool_name": "Bash", "tool_input": {"command": "..."}, "tool_response": {"output": "..."}}
    Output: nothing (stderr warning only)
    """
    tool_name = data.get("tool_name", "")
    if tool_name != "Bash":
        return

    tool_input    = data.get("tool_input", {}) or {}
    tool_response = data.get("tool_response", {}) or {}
    command = tool_input.get("command", "") or ""
    output  = str(tool_response.get("output", "") or "")
    output_tokens = estimate_tokens(output)

    suggestion, mcp_alt_tokens = _check_wasteful(command)
    waste_tokens = max(0, output_tokens - mcp_alt_tokens) if suggestion else 0

    if waste_tokens > 0:
        short_cmd = command[:60] + "…" if len(command) > 60 else command
        sys.stderr.write(
            f"\n⚠️  TOKEN WASTE DETECTED\n"
            f"   Command    : {short_cmd}\n"
            f"   Bash cost  : ~{output_tokens:,} tokens\n"
            f"   Use instead: {suggestion} (~{mcp_alt_tokens} tokens)\n"
            f"   Wasted     : ~{waste_tokens:,} tokens\n\n"
        )
        sys.stderr.flush()

    log_event({
        "type":          "bash",
        "source":        "claude-code",
        "cmd":           command[:120],
        "output_tokens": output_tokens,
        "waste_tokens":  waste_tokens,
        "suggestion":    suggestion,
    })


def handle_cursor(data: dict) -> None:
    """Cursor beforeShellExecution format:
    {"hook_event_name": "beforeShellExecution", "command": "git status",
     "cwd": "", "workspace_roots": [...], "conversation_id": "...", "generation_id": "..."}
    Output: JSON to stdout — {"continue": true, "agentMessage": "..."}
    """
    command = data.get("command", "") or ""
    suggestion, mcp_alt_tokens = _check_wasteful(command)

    # Always log
    log_event({
        "type":          "bash",
        "source":        "cursor",
        "cmd":           command[:120],
        "output_tokens": 0,          # not available before execution
        "waste_tokens":  0,
        "suggestion":    suggestion,
        "conversation_id": data.get("conversation_id", ""),
    })

    # Build response — always allow, optionally add agentMessage hint
    response: dict = {"continue": True}
    if suggestion:
        short_cmd = command[:60] + "…" if len(command) > 60 else command
        response["agentMessage"] = (
            f"[flowctl] Consider using {suggestion} instead of `{short_cmd}` "
            f"— MCP tool costs ~{mcp_alt_tokens} tokens vs bash output."
        )

    print(json.dumps(response))


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        sys.exit(0)

    hook_event = data.get("hook_event_name", "")
    if hook_event == "beforeShellExecution":
        # Cursor hook
        handle_cursor(data)
    else:
        # Claude Code PostToolUse (no hook_event_name field)
        handle_claude_code(data)

    sys.exit(0)

if __name__ == "__main__":
    main()
