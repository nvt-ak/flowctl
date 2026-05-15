# flowctl — Quick start (session mở)

1. **Index vai trò**: [.cursor/INDEX.md](.cursor/INDEX.md) — map role → agent file; rules/skills chỉ khi cần.
2. **State**: `wf_state()` hoặc `flowctl status` — file state workflow (mặc định `flowctl-state.json`, hoặc path qua `FLOWCTL_STATE_FILE` / `flowctl flow switch`).
3. **Làm step**: `flowctl start` → `flowctl complexity` → `flowctl cursor-dispatch` (tự gate War Room theo score; ngưỡng mặc định **4**). Worker đọc **Context Snapshot** trong brief trước; `wf_step_context()` khi cần mới hơn.
4. **PM điều chỉnh rủi ro** (trước dispatch):  
   `flowctl cursor-dispatch --high-risk --impacted-modules 5` hoặc `--force-war-room`  
   Chi tiết scoring + token tùy chọn (Caveman, RTK, cavemem): [docs/workflow-reference.md](docs/workflow-reference.md).
5. **Sau workers**: `flowctl collect` → `flowctl gate-check` — không tự `flowctl approve`; chờ human.

```bash
flowctl assess          # skip steps không cần
flowctl skip --preset api-only --reason "..."
flowctl start
flowctl complexity
flowctl cursor-dispatch
```

**MCP**: `flowctl mcp --shell-proxy` | `flowctl mcp --workflow-state` — cấu hình trong `.cursor/mcp.json` (template ghi `FLOWCTL_PROJECT_ROOT: "${workspaceFolder}"`). Song song nhiều luồng: xem `flowctl flow …` và biến `FLOWCTL_STATE_FILE` / `FLOWCTL_ACTIVE_FLOW` trong [docs/workflow-reference.md](docs/workflow-reference.md#đa-luồng-state-nhiều-task-song-song-trong-một-clone).

**Slash (Cursor)**: `.cursor/commands/kickoff.md`, `brief.md`, `report.md`, `done.md`, `load-skill.md`.

---

Chi tiết đầy đủ (MCP danh sách, skip presets, approval template, parallel patterns, GitNexus): [docs/workflow-reference.md](docs/workflow-reference.md).

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **flowctl** (3861 symbols, 5901 relationships, 177 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/flowctl/context` | Codebase overview, check index freshness |
| `gitnexus://repo/flowctl/clusters` | All functional areas |
| `gitnexus://repo/flowctl/processes` | All execution flows |
| `gitnexus://repo/flowctl/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
