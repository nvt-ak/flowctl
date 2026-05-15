<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **flowctl** (2139 symbols, 2723 relationships, 29 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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

**flowctl War Room (repo):** default `WF_WAR_ROOM_THRESHOLD=4` (FULL tier = score ≥ 4). `flowctl cursor-dispatch` supports `--high-risk`, `--impacted-modules N`, `--force-war-room`, `--skip-war-room`, `--merge`. Worker briefs embed a **Context Snapshot**; use `wf_step_context()` when you need fresher workflow state than the brief. See `docs/workflow-reference.md` and `.cursor/INDEX.md`.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

## Config

# IT Product Team Workflow — Orchestration Guide
# Đọc file này trước khi làm bất cứ việc gì trong project

## ⚡ Khởi Động Nhanh

Khi bắt đầu một session mới, dùng **MCP tools** (không phải bash — tiết kiệm ~95% token):

```
# 1. Đọc flowctl state
wf_state()              ← thay cho: cat flowctl-state.json + flowctl status

# 2. Đọc context đầy đủ của step hiện tại
wf_step_context()       ← thay cho: đọc 5+ files riêng lẻ

# 3. Code structure (chỉ dùng ở steps 4-8)
cat graphify-out/GRAPH_REPORT.md   ← overview nhanh
```

> **Quy tắc token**: Dùng MCP tools trước bash. Bash chỉ dùng cho write operations.
---

## 🤖 Hệ Thống Agent

### Nguyên Tắc Kích Hoạt Agent

**Chỉ kích hoạt agent phù hợp với step hiện tại.** Đọc `flowctl-state.json` để biết step nào đang active. Các steps có thể bị skip — dùng `flowctl assess` để xem steps nào đang active.

| Step | Agent Chính | Agent Hỗ Trợ | File Agent |
|------|-------------|--------------|------------|
| 1 — Requirements | `@pm` | `@tech-lead` | `.cursor/agents/pm-agent.md` |
| 2 — System Design | `@tech-lead` | `@backend`, `@pm` | `.cursor/agents/tech-lead-agent.md` |
| 3 — UI/UX Design | `@ui-ux` | `@frontend`, `@pm` | `.cursor/agents/ui-ux-agent.md` |
| 4 — Backend Dev | `@backend` | `@tech-lead` | `.cursor/agents/backend-dev-agent.md` |
| 5 — Frontend Dev | `@frontend` | `@ui-ux`, `@tech-lead` | `.cursor/agents/frontend-dev-agent.md` |
| 6 — Integration | `@tech-lead` | `@backend`, `@frontend` | `.cursor/agents/tech-lead-agent.md` |
| 7 — QA Testing | `@qa` | tất cả devs | `.cursor/agents/qa-agent.md` |
| 8 — DevOps | `@devops` | `@tech-lead` | `.cursor/agents/devops-agent.md` |
| 9 — Release | `@pm` + `@tech-lead` | tất cả | tất cả agents |

> **Lưu ý**: Không phải task nào cần đủ 9 steps. PM dùng `flowctl assess` + `flowctl skip` để bỏ qua steps không cần thiết trước khi bắt đầu.

### Parallel Agent Execution

```
# Ví dụ: Step 1 — PM và Tech Lead phân tích song song
Mở 2 Cursor Agent Tabs:
  Tab 1: @pm — Thu thập và phân tích requirements
  Tab 2: @tech-lead — Đánh giá feasibility kỹ thuật
→ Tổng hợp kết quả về main tab → Approval gate
```
---

## 🔧 MCP Tools Có Sẵn

### ⚡ Shell Proxy Tools — DÙNG TRƯỚC (token-efficient)

```
wf_state()                       — Workflow state (step, status, blockers, decisions)
                                   Saving: ~1,900 → ~100 tokens (95%)

wf_git(commits?)                 — Git snapshot (branch, commits, changed files)
                                   Saving: ~1,000 → ~80 tokens (92%)

wf_step_context(step?)           — Full step context (state + decisions + blockers + war room)
                                   Saving: ~5,000 → ~300 tokens (94%)

wf_files(dir?, pattern?, depth?) — Project file listing
                                   Saving: ~500 → ~100 tokens (80%)

wf_read(path, max_lines?, compress?) — Read file with caching (cache hit = free)

wf_env()                         — OS, tool versions, paths (cached forever)

wf_cache_invalidate(scope?)      — Invalidate cache (all|git|state|files)
                                   Gọi sau khi write/modify state
```

**Thứ tự ưu tiên:**
```
1. wf_step_context()                 ← tất cả workflow context trong 1 call
2. wf_state()                        ← nếu chỉ cần flowctl state
3. wf_git()                          ← nếu cần git context
4. cat graphify-out/GRAPH_REPORT.md  ← code structure (steps 4-8 only)
5. wf_read()                         ← nếu cần đọc file cụ thể
6. bash [cmd]                        ← CHỈ cho write operations
```

### Workflow State MCP Tools

Ghi vào **file state workflow** (mặc định `flowctl-state.json` ở root hoặc path do `FLOWCTL_STATE_FILE` / `.flowctl/flows.json` resolve — xem mục đa luồng trong `docs/workflow-reference.md`) qua MCP server (`workflow-state.js`):

```
flow_get_state()                — Đọc trạng thái hiện tại
flow_advance_step(by, notes)    — Approve và chuyển sang step tiếp theo
flow_request_approval(note)     — Ghi approval request vào decisions
flow_add_blocker(description)   — Ghi nhận blocker
flow_add_decision(description)  — Ghi lại quyết định quan trọng
```

**Đa luồng:** `export FLOWCTL_STATE_FILE=/path/to/state.json` hoặc `FLOWCTL_ACTIVE_FLOW=wf-...` trong terminal; với Cursor có thể thêm env tương tự vào entry MCP. CLI: `flowctl flow list|new|switch`.

### Graphify (code structure — steps 4-8 only)

**Graphify KHÔNG có MCP server.** Đọc file output trực tiếp:

```bash
cat graphify-out/GRAPH_REPORT.md          # overview: clusters, top nodes
python3 -c "
import json; g = json.load(open('graphify-out/graph.json'))
keyword = 'auth'
for n in g.get('nodes',{}).values():
    if keyword in n.get('name','').lower(): print(n['name'], '—', n.get('file',''))
"
# Rebuild sau khi sửa code:
python3 -m graphify update .
```

- ✅ ĐÚNG: hiểu call graph, module dependencies, database schema
- ❌ SAI: query requirements, decisions, blockers → dùng `wf_step_context()` thay thế
- ❌ SAI: `query_graph()`, `get_node()` — không phải MCP tools, không tồn tại

### GitNexus (tùy chọn)

GitNexus là **CLI git workflow** — smart commits, branch naming, PR descriptions.
Không phải MCP server. Không có tool calls. Dùng qua terminal:
```bash
gitnexus commit    # smart commit message từ diff
gitnexus pr        # generate PR description
```
---

## 📋 Quy Trình Mỗi Step

### Khi BẮT ĐẦU project (trước step 1):

```bash
flowctl assess                              # xem all steps + gợi ý skip
flowctl skip --preset hotfix               # hoặc
flowctl skip --steps 3,5 --reason "..."   # custom skip
flowctl start                              # bắt đầu (auto-advance qua skipped steps)
```

### Khi BẮT ĐẦU một step mới:

```
1. wf_step_context()                       → Load workflow context (decisions, blockers)
2. cat graphify-out/GRAPH_REPORT.md        → Code structure (steps 4-8, nếu có)
3. Đọc .cursor/agents/<role>-agent.md      → Load agent persona và skills
4. Tạo kickoff document                    → workflows/steps/NN-<name>.md
```

### Trong khi THỰC HIỆN step:

```
- Mọi quyết định quan trọng → flow_add_decision("mô tả")
- Mọi blocker phát sinh     → flow_add_blocker("mô tả")
- Code structure questions  → cat graphify-out/graph.json (steps 4-8 only)
```

### Khi KẾT THÚC step:

```
1. Tạo step summary (dùng .cursor/templates/step-summary-template.md)
2. Điền review checklist (.cursor/templates/review-checklist-template.md)
3. flow_request_approval("summary ngắn gọn")
4. ⏸️  DỪNG — Chờ human approve trước khi sang step tiếp theo
```

### Khi NHẬN APPROVAL:

```
APPROVED       → flowctl approve --by "Name" → Bắt đầu step tiếp theo
REJECTED       → Address concerns → Re-submit
CONDITIONAL    → Fix specific items → Verify → Continue
```
---

## 🚨 Approval Gate — Quy Tắc Bắt Buộc

> **QUAN TRỌNG**: Agent KHÔNG ĐƯỢC tự động chuyển sang step tiếp theo.
> Mỗi step kết thúc bằng một approval request. Agent phải DỪNG và chờ
> human approve (hoặc reject) trước khi tiếp tục.

**Format Approval Request:**

```markdown
## 🔔 APPROVAL REQUEST — Step [N]: [Step Name]

**Agent**: @[role]
**Ngày hoàn thành**: YYYY-MM-DD
**Duration**: X ngày

### Tóm Tắt (Executive Summary)
[2-3 câu cho PM đọc, không kỹ thuật]

### Deliverables Hoàn Thành
- [x] Deliverable 1
- [x] Deliverable 2

### Metrics
- Coverage: X%
- Tests passed: N/N
- Performance: [kết quả]

### Risks & Issues
[Liệt kê nếu có]

---
**Quyết định cần thiết**: APPROVE / REJECT / CONDITIONAL
**Người approve**: @pm và @tech-lead
```
---

## 🔄 Parallel Execution Patterns

**Pattern 1: Parallel Research (Steps 1-2)**
```
Main Agent (PM orchestrator)
    ├── [Tab 1] @pm         → Stakeholder requirements analysis
    ├── [Tab 2] @tech-lead  → Technical feasibility + constraints
    └── [Tab 3] @ui-ux      → Competitor UX research (nếu cần)
    ↓
Merge results → Consolidated PRD → Approval Gate
```

**Pattern 2: Parallel Development (Steps 4-5)**
```
Điều kiện: API contract đã được define ở Step 2

Main Agent
    ├── [Tab 1] @backend   → API implementation
    └── [Tab 2] @frontend  → UI với mock API
    ↓
Integration checkpoint mỗi ngày → Final merge → Step 6
```

**Pattern 3: Parallel QA (Step 7)**
```
Main Agent
    ├── [Tab 1] @qa        → Manual test cases
    ├── [Tab 2] @backend   → Unit + integration tests
    └── [Tab 3] @frontend  → E2E tests + visual regression
    ↓
Tổng hợp test results → QA sign-off → Approval Gate
```
---

## 📁 Cấu Trúc File Quan Trọng

```
CLAUDE.md                          ← File này — đọc đầu tiên
flowctl-state.json                 ← Trạng thái hiện tại của flowctl
flowctl                            ← CLI quản lý workflow

.cursor/
  mcp.json                         ← MCP server config
  agents/
    pm-agent.md                    ← PM Agent (Step 1, 9 + orchestrator)
    tech-lead-agent.md             ← Tech Lead Agent (Step 2, 6)
    backend-dev-agent.md           ← Backend Dev Agent (Step 4)
    frontend-dev-agent.md          ← Frontend Dev Agent (Step 5)
    ui-ux-agent.md                 ← UI/UX Agent (Step 3)
    devops-agent.md                ← DevOps Agent (Step 8)
    qa-agent.md                    ← QA Agent (Step 7)
  rules/
    core-rules.mdc                 ← Invariant workflow + quality + approvals (English)
    tool-constraints.mdc           ← Graphify + GitNexus guardrails (English)
    review-rules.mdc               ← PR / code review invariants (English)
  templates/
    step-summary-template.md       ← Template tạo summary
    review-checklist-template.md   ← Template review
    approval-request-template.md   ← Template approval

workflows/
  steps/                           ← Step documents (tạo khi làm)

graphify-out/                      ← Code structure graph (steps 4-8)
  GRAPH_REPORT.md                  ← Overview: clusters, top nodes
  graph.json                       ← Full graph data

scripts/workflow/mcp/
  shell-proxy.js                   ← Shell Proxy MCP server (wf_* tools)
  workflow-state.js                ← Workflow State MCP server (flow_* tools)
```
---

## 🛠️ Setup Lần Đầu

```bash
# Khởi tạo project (+ setup MCP, .gitignore tự động)
flowctl init --project "Tên dự án"

# Bỏ qua setup: flowctl init --no-setup --project "..." hoặc FLOWCTL_SKIP_SETUP=1

# Sau init: Reload Cursor
# Cmd/Ctrl+Shift+P → "Developer: Reload Window"

# Verify MCP servers: Cursor → Settings → Features → MCP → servers màu xanh
```

## 🆕 Skip Workflow (v1.3.0+)

PM assess và skip steps không cần thiết trước khi bắt đầu làm:

```bash
flowctl assess                                     # xem all steps + gợi ý
flowctl skip --preset hotfix                       # skip 2,3,5,6
flowctl skip --preset api-only                     # skip 3,5
flowctl skip --steps 3,5 --type api-only \
             --reason "REST API endpoint only"     # custom
flowctl unskip --step 3 --reason "cần UI sau khi team review"  # reverse
```

| Preset | Steps bị skip | Dùng khi |
|--------|--------------|----------|
| `hotfix` | 2,3,5,6 | Hotfix production khẩn |
| `api-only` | 3,5 | REST API, không có UI |
| `backend-api` | 3,5 | Backend service |
| `frontend-only` | 2,4,6,8 | Chỉ UI changes |
| `design-sprint` | 4,5,6,7,8,9 | Design only |
| `research` | 3,4,5,6,7,8,9 | Research spike |
| `devops-only` | 1,2,3,4,5,6,7 | Infra/DevOps task |
| `qa-only` | 1,2,3,4,5,6,8 | QA audit only |

<!-- gitnexus:start -->
## GitNexus — Git Intelligence (Tùy Chọn)

GitNexus là công cụ git workflow: smart commit messages, branch naming, PR descriptions.

```bash
npm install -g gitnexus
flowctl init --overwrite   # re-generate mcp.json với gitnexus entry
# Reload Cursor sau đó
```

> **Lưu ý**: GitNexus là CLI tool, không phải MCP server. Không có tool calls như `gitnexus_get_architecture()`. Dùng qua terminal (`gitnexus commit`, `gitnexus pr`).
<!-- gitnexus:end -->
---

## Rule: README

# Rules
## Structure

Rules are organized into a **common** layer plus **language-specific** directories:

```
rules/
├── common/          # Language-agnostic principles (always install)
│   ├── coding-style.md
│   ├── git-workflow.md
│   ├── testing.md
│   ├── performance.md
│   ├── patterns.md
│   ├── hooks.md
│   ├── agents.md
│   └── security.md
├── typescript/      # TypeScript/JavaScript specific
├── python/          # Python specific
├── golang/          # Go specific
├── web/             # Web and frontend specific
├── swift/           # Swift specific
└── php/             # PHP specific
```

- **common/** contains universal principles — no language-specific code examples.
- **Language directories** extend the common rules with framework-specific patterns, tools, and code examples. Each file references its common counterpart.

## Installation

### Option 1: Install Script (Recommended)

```bash
# Install common + one or more language-specific rule sets
./install.sh typescript
./install.sh python
./install.sh golang
./install.sh web
./install.sh swift
./install.sh php

# Install multiple languages at once
./install.sh typescript python
```

### Option 2: Manual Installation

> **Important:** Copy entire directories — do NOT flatten with `/*`.
> Common and language-specific directories contain files with the same names.
> Flattening them into one directory causes language-specific files to overwrite
> common rules, and breaks the relative `..` references used by
> language-specific files.

```bash
# Install common rules (required for all projects)
cp -r rules/common ~/.claude/rules/common

# Install language-specific rules based on your project's tech stack
cp -r rules/typescript ~/.claude/rules/typescript
cp -r rules/python ~/.claude/rules/python
cp -r rules/golang ~/.claude/rules/golang
cp -r rules/web ~/.claude/rules/web
cp -r rules/swift ~/.claude/rules/swift
cp -r rules/php ~/.claude/rules/php

# Attention ! ! ! Configure according to your actual project requirements; the configuration here is for reference only.
```

## Rules vs Skills

- **Rules** define standards, conventions, and checklists that apply broadly (e.g., "80% test coverage", "no hardcoded secrets").
- **Skills** (`skills/` directory) provide deep, actionable reference material for specific tasks (e.g., `python-patterns`, `golang-testing`).

Language-specific rule files reference relevant skills where appropriate. Rules tell you *what* to do; skills tell you *how* to do it.

## Adding a New Language

To add support for a new language (e.g., `rust/`):

1. Create a `rules/rust/` directory
2. Add files that extend the common rules:
   - `coding-style.md` — formatting tools, idioms, error handling patterns
   - `testing.md` — test framework, coverage tools, test organization
   - `patterns.md` — language-specific design patterns
   - `hooks.md` — PostToolUse hooks for formatters, linters, type checkers
   - `security.md` — secret management, security scanning tools
3. Each file should start with:
   ```
   > This file extends [common/xxx.md](../common/xxx.md) with <Language> specific content.
   ```
4. Reference existing skills if available, or create new ones under `skills/`.

For non-language domains like `web/`, follow the same layered pattern when there is enough reusable domain-specific guidance to justify a standalone ruleset.

## Rule Priority

When language-specific rules and common rules conflict, **language-specific rules take precedence** (specific overrides general). This follows the standard layered configuration pattern (similar to CSS specificity or `.gitignore` precedence).

- `rules/common/` defines universal defaults applicable to all projects.
- `rules/golang/`, `rules/python/`, `rules/swift/`, `rules/php/`, `rules/typescript/`, etc. override those defaults where language idioms differ.

### Example

`common/coding-style.md` recommends immutability as a default principle. A language-specific `golang/coding-style.md` can override this:

> Idiomatic Go uses pointer receivers for struct mutation — see [common/coding-style.md](../common/coding-style.md) for the general principle, but Go-idiomatic mutation is preferred here.

### Common rules with override notes

Rules in `rules/common/` that may be overridden by language-specific files are marked with:

> **Language note**: This rule may be overridden by language-specific rules for languages where this pattern is not idiomatic.
---

## Rule: common/agents

# Agent Orchestration

## Available Agents

Located in `~/.codex/agents`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build fails |
| e2e-runner | E2E testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |
| rust-reviewer | Rust code review | Rust projects |

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
---

## Rule: common/code-review

# Code Review Standards

## Purpose

Code review ensures quality, security, and maintainability before code is merged. This rule defines when and how to conduct code reviews.

## When to Review

**MANDATORY review triggers:**

- After writing or modifying code
- Before any commit to shared branches
- When security-sensitive code is changed (auth, payments, user data)
- When architectural changes are made
- Before merging pull requests

**Pre-Review Requirements:**

Before requesting review, ensure:

- All automated checks (CI/CD) are passing
- Merge conflicts are resolved
- Branch is up to date with target branch

## Review Checklist

Before marking code complete:

- [ ] Code is readable and well-named
- [ ] Functions are focused (<50 lines)
- [ ] Files are cohesive (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Errors are handled explicitly
- [ ] No hardcoded secrets or credentials
- [ ] No console.log or debug statements
- [ ] Tests exist for new functionality
- [ ] Test coverage meets 80% minimum

## Security Review Triggers

**STOP and use security-reviewer agent when:**

- Authentication or authorization code
- User input handling
- Database queries
- File system operations
- External API calls
- Cryptographic operations
- Payment or financial code

## Review Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| CRITICAL | Security vulnerability or data loss risk | **BLOCK** - Must fix before merge |
| HIGH | Bug or significant quality issue | **WARN** - Should fix before merge |
| MEDIUM | Maintainability concern | **INFO** - Consider fixing |
| LOW | Style or minor suggestion | **NOTE** - Optional |

## Agent Usage

Use these agents for code review:

| Agent | Purpose |
|-------|---------|
| **code-reviewer** | General code quality, patterns, best practices |
| **security-reviewer** | Security vulnerabilities, OWASP Top 10 |
| **typescript-reviewer** | TypeScript/JavaScript specific issues |
| **python-reviewer** | Python specific issues |
| **go-reviewer** | Go specific issues |
| **rust-reviewer** | Rust specific issues |

## Review Workflow

```
1. Run git diff to understand changes
2. Check security checklist first
3. Review code quality checklist
4. Run relevant tests
5. Verify coverage >= 80%
6. Use appropriate agent for detailed review
```

## Common Issues to Catch

### Security

- Hardcoded credentials (API keys, passwords, tokens)
- SQL injection (string concatenation in queries)
- XSS vulnerabilities (unescaped user input)
- Path traversal (unsanitized file paths)
- CSRF protection missing
- Authentication bypasses

### Code Quality

- Large functions (>50 lines) - split into smaller
- Large files (>800 lines) - extract modules
- Deep nesting (>4 levels) - use early returns
- Missing error handling - handle explicitly
- Mutation patterns - prefer immutable operations
- Missing tests - add test coverage

### Performance

- N+1 queries - use JOINs or batching
- Missing pagination - add LIMIT to queries
- Unbounded queries - add constraints
- Missing caching - cache expensive operations

## Approval Criteria

- **Approve**: No CRITICAL or HIGH issues
- **Warning**: Only HIGH issues (merge with caution)
- **Block**: CRITICAL issues found

## Integration with Other Rules

This rule works with:

- [testing.md](testing.md) - Test coverage requirements
- [security.md](security.md) - Security checklist
- [git-workflow.md](git-workflow.md) - Commit standards
- [agents.md](agents.md) - Agent delegation
---

## Rule: common/coding-style

# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
---

## Rule: common/development-workflow

# Development Workflow

> This file extends [common/git-workflow.md](./git-workflow.md) with the full feature development process that happens before git operations.

The Feature Implementation Workflow describes the development pipeline: research, planning, TDD, code review, and then committing to git.

## Feature Implementation Workflow

0. **Research & Reuse** _(mandatory before any new implementation)_
   - **GitHub code search first:** Run `gh search repos` and `gh search code` to find existing implementations, templates, and patterns before writing anything new.
   - **Library docs second:** Use Context7 or primary vendor docs to confirm API behavior, package usage, and version-specific details before implementing.
   - **Exa only when the first two are insufficient:** Use Exa for broader web research or discovery after GitHub search and primary docs.
   - **Check package registries:** Search npm, PyPI, crates.io, and other registries before writing utility code. Prefer battle-tested libraries over hand-rolled solutions.
   - **Search for adaptable implementations:** Look for open-source projects that solve 80%+ of the problem and can be forked, ported, or wrapped.
   - Prefer adopting or porting a proven approach over writing net-new code when it meets the requirement.

1. **Plan First**
   - Use **planner** agent to create implementation plan
   - Generate planning docs before coding: PRD, architecture, system_design, tech_doc, task_list
   - Identify dependencies and risks
   - Break down into phases

2. **TDD Approach**
   - Use **tdd-guide** agent
   - Write tests first (RED)
   - Implement to pass tests (GREEN)
   - Refactor (IMPROVE)
   - Verify 80%+ coverage

3. **Code Review**
   - Use **code-reviewer** agent immediately after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

4. **Commit & Push**
   - Detailed commit messages
   - Follow conventional commits format
   - See [git-workflow.md](./git-workflow.md) for commit message format and PR process

5. **Pre-Review Checks**
   - Verify all automated checks (CI/CD) are passing
   - Resolve any merge conflicts
   - Ensure branch is up to date with target branch
   - Only request review after these checks pass
---

## Rule: common/git-workflow

# Git Workflow

## Commit Message Format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Note: Attribution disabled globally via ~/.claude/settings.json.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
---

## Rule: common/hooks

# Hooks System

## Hook Types

- **PreToolUse**: Before tool execution (validation, parameter modification)
- **PostToolUse**: After tool execution (auto-format, checks)
- **Stop**: When session ends (final verification)

## Auto-Accept Permissions

Use with caution:
- Enable for trusted, well-defined plans
- Disable for exploratory work
- Never use dangerously-skip-permissions flag
- Configure `allowedTools` in `~/.claude.json` instead

## TodoWrite Best Practices

Use TodoWrite tool to:
- Track progress on multi-step tasks
- Verify understanding of instructions
- Enable real-time steering
- Show granular implementation steps

Todo list reveals:
- Out of order steps
- Missing items
- Extra unnecessary items
- Wrong granularity
- Misinterpreted requirements
---

## Rule: common/patterns

# Common Patterns

## Skeleton Projects

When implementing new functionality:
1. Search for battle-tested skeleton projects
2. Use parallel agents to evaluate options:
   - Security assessment
   - Extensibility analysis
   - Relevance scoring
   - Implementation planning
3. Clone best match as foundation
4. Iterate within proven structure

## Design Patterns

### Repository Pattern

Encapsulate data access behind a consistent interface:
- Define standard operations: findAll, findById, create, update, delete
- Concrete implementations handle storage details (database, API, file, etc.)
- Business logic depends on the abstract interface, not the storage mechanism
- Enables easy swapping of data sources and simplifies testing with mocks

### API Response Format

Use a consistent envelope for all API responses:
- Include a success/status indicator
- Include the data payload (nullable on error)
- Include an error message field (nullable on success)
- Include metadata for paginated responses (total, page, limit)
---

## Rule: common/performance

# Performance Optimization

## Model Selection Strategy

**Haiku 4.5** (90% of Sonnet capability, 3x cost savings):
- Lightweight agents with frequent invocation
- Pair programming and code generation
- Worker agents in multi-agent systems

**Sonnet 4.6** (Best coding model):
- Main development work
- Orchestrating multi-agent workflows
- Complex coding tasks

**Opus 4.5** (Deepest reasoning):
- Complex architectural decisions
- Maximum reasoning requirements
- Research and analysis tasks

## Context Window Management

Avoid last 20% of context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Extended Thinking + Plan Mode

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:
- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:
1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives

## Build Troubleshooting

If build fails:
1. Use **build-error-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
---

## Rule: common/security

# Security Guidelines

## Mandatory Security Checks

Before ANY commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML)
- [ ] CSRF protection enabled
- [ ] Authentication/authorization verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages don't leak sensitive data

## Secret Management

- NEVER hardcode secrets in source code
- ALWAYS use environment variables or a secret manager
- Validate that required secrets are present at startup
- Rotate any secrets that may have been exposed

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Use **security-reviewer** agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review entire codebase for similar issues
---

## Rule: common/testing

# Testing Requirements

## Minimum Test Coverage: 80%

Test Types (ALL required):
1. **Unit Tests** - Individual functions, utilities, components
2. **Integration Tests** - API endpoints, database operations
3. **E2E Tests** - Critical user flows (framework chosen per language)

## Test-Driven Development

MANDATORY workflow:
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+)

## Troubleshooting Test Failures

1. Use **tdd-guide** agent
2. Check test isolation
3. Verify mocks are correct
4. Fix implementation, not tests (unless tests are wrong)

## Agent Support

- **tdd-guide** - Use PROACTIVELY for new features, enforces write-tests-first
---

## Rule: cpp/coding-style
---

paths:
  - "**/*.cpp"
  - "**/*.hpp"
  - "**/*.cc"
  - "**/*.hh"
  - "**/*.cxx"
  - "**/*.h"
  - "**/CMakeLists.txt"
---

# C++ Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with C++ specific content.

## Modern C++ (C++17/20/23)

- Prefer **modern C++ features** over C-style constructs
- Use `auto` when the type is obvious from context
- Use `constexpr` for compile-time constants
- Use structured bindings: `auto [key, value] = map_entry;`

## Resource Management

- **RAII everywhere** — no manual `new`/`delete`
- Use `std::unique_ptr` for exclusive ownership
- Use `std::shared_ptr` only when shared ownership is truly needed
- Use `std::make_unique` / `std::make_shared` over raw `new`

## Naming Conventions

- Types/Classes: `PascalCase`
- Functions/Methods: `snake_case` or `camelCase` (follow project convention)
- Constants: `kPascalCase` or `UPPER_SNAKE_CASE`
- Namespaces: `lowercase`
- Member variables: `snake_case_` (trailing underscore) or `m_` prefix

## Formatting

- Use **clang-format** — no style debates
- Run `clang-format -i <file>` before committing

## Reference

See skill: `cpp-coding-standards` for comprehensive C++ coding standards and guidelines.
---

## Rule: cpp/hooks
---

paths:
  - "**/*.cpp"
  - "**/*.hpp"
  - "**/*.cc"
  - "**/*.hh"
  - "**/*.cxx"
  - "**/*.h"
  - "**/CMakeLists.txt"
---

# C++ Hooks

> This file extends [common/hooks.md](../common/hooks.md) with C++ specific content.

## Build Hooks

Run these checks before committing C++ changes:

```bash
# Format check
clang-format --dry-run --Werror src/*.cpp src/*.hpp

# Static analysis
clang-tidy src/*.cpp -- -std=c++17

# Build
cmake --build build

# Tests
ctest --test-dir build --output-on-failure
```

## Recommended CI Pipeline

1. **clang-format** — formatting check
2. **clang-tidy** — static analysis
3. **cppcheck** — additional analysis
4. **cmake build** — compilation
5. **ctest** — test execution with sanitizers
---

## Rule: cpp/patterns
---

paths:
  - "**/*.cpp"
  - "**/*.hpp"
  - "**/*.cc"
  - "**/*.hh"
  - "**/*.cxx"
  - "**/*.h"
  - "**/CMakeLists.txt"
---

# C++ Patterns

> This file extends [common/patterns.md](../common/patterns.md) with C++ specific content.

## RAII (Resource Acquisition Is Initialization)

Tie resource lifetime to object lifetime:

```cpp
class FileHandle {
public:
    explicit FileHandle(const std::string& path) : file_(std::fopen(path.c_str(), "r")) {}
    ~FileHandle() { if (file_) std::fclose(file_); }
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;
private:
    std::FILE* file_;
};
```

## Rule of Five/Zero

- **Rule of Zero**: Prefer classes that need no custom destructor, copy/move constructors, or assignments
- **Rule of Five**: If you define any of destructor/copy-ctor/copy-assign/move-ctor/move-assign, define all five

## Value Semantics

- Pass small/trivial types by value
- Pass large types by `const&`
- Return by value (rely on RVO/NRVO)
- Use move semantics for sink parameters

## Error Handling

- Use exceptions for exceptional conditions
- Use `std::optional` for values that may not exist
- Use `std::expected` (C++23) or result types for expected failures

## Reference

See skill: `cpp-coding-standards` for comprehensive C++ patterns and anti-patterns.
---

## Rule: cpp/security
---

paths:
  - "**/*.cpp"
  - "**/*.hpp"
  - "**/*.cc"
  - "**/*.hh"
  - "**/*.cxx"
  - "**/*.h"
  - "**/CMakeLists.txt"
---

# C++ Security

> This file extends [common/security.md](../common/security.md) with C++ specific content.

## Memory Safety

- Never use raw `new`/`delete` — use smart pointers
- Never use C-style arrays — use `std::array` or `std::vector`
- Never use `malloc`/`free` — use C++ allocation
- Avoid `reinterpret_cast` unless absolutely necessary

## Buffer Overflows

- Use `std::string` over `char*`
- Use `.at()` for bounds-checked access when safety matters
- Never use `strcpy`, `strcat`, `sprintf` — use `std::string` or `fmt::format`

## Undefined Behavior

- Always initialize variables
- Avoid signed integer overflow
- Never dereference null or dangling pointers
- Use sanitizers in CI:
  ```bash
  cmake -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined" ..
  ```

## Static Analysis

- Use **clang-tidy** for automated checks:
  ```bash
  clang-tidy --checks='*' src/*.cpp
  ```
- Use **cppcheck** for additional analysis:
  ```bash
  cppcheck --enable=all src/
  ```

## Reference

See skill: `cpp-coding-standards` for detailed security guidelines.
---

## Rule: cpp/testing
---

paths:
  - "**/*.cpp"
  - "**/*.hpp"
  - "**/*.cc"
  - "**/*.hh"
  - "**/*.cxx"
  - "**/*.h"
  - "**/CMakeLists.txt"
---

# C++ Testing

> This file extends [common/testing.md](../common/testing.md) with C++ specific content.

## Framework

Use **GoogleTest** (gtest/gmock) with **CMake/CTest**.

## Running Tests

```bash
cmake --build build && ctest --test-dir build --output-on-failure
```

## Coverage

```bash
cmake -DCMAKE_CXX_FLAGS="--coverage" -DCMAKE_EXE_LINKER_FLAGS="--coverage" ..
cmake --build .
ctest --output-on-failure
lcov --capture --directory . --output-file coverage.info
```

## Sanitizers

Always run tests with sanitizers in CI:

```bash
cmake -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined" ..
```

## Reference

See skill: `cpp-testing` for detailed C++ testing patterns, TDD workflow, and GoogleTest/GMock usage.
---

## Rule: csharp/coding-style
---

paths:
  - "**/*.cs"
  - "**/*.csx"
---

# C# Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with C#-specific content.

## Standards

- Follow current .NET conventions and enable nullable reference types
- Prefer explicit access modifiers on public and internal APIs
- Keep files aligned with the primary type they define

## Types and Models

- Prefer `record` or `record struct` for immutable value-like models
- Use `class` for entities or types with identity and lifecycle
- Use `interface` for service boundaries and abstractions
- Avoid `dynamic` in application code; prefer generics or explicit models

```csharp
public sealed record UserDto(Guid Id, string Email);

public interface IUserRepository
{
    Task<UserDto?> FindByIdAsync(Guid id, CancellationToken cancellationToken);
}
```

## Immutability

- Prefer `init` setters, constructor parameters, and immutable collections for shared state
- Do not mutate input models in-place when producing updated state

```csharp
public sealed record UserProfile(string Name, string Email);

public static UserProfile Rename(UserProfile profile, string name) =>
    profile with { Name = name };
```

## Async and Error Handling

- Prefer `async`/`await` over blocking calls like `.Result` or `.Wait()`
- Pass `CancellationToken` through public async APIs
- Throw specific exceptions and log with structured properties

```csharp
public async Task<Order> LoadOrderAsync(
    Guid orderId,
    CancellationToken cancellationToken)
{
    try
    {
        return await repository.FindAsync(orderId, cancellationToken)
            ?? throw new InvalidOperationException($"Order {orderId} was not found.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to load order {OrderId}", orderId);
        throw;
    }
}
```

## Formatting

- Use `dotnet format` for formatting and analyzer fixes
- Keep `using` directives organized and remove unused imports
- Prefer expression-bodied members only when they stay readable
---

## Rule: csharp/hooks
---

paths:
  - "**/*.cs"
  - "**/*.csx"
  - "**/*.csproj"
  - "**/*.sln"
  - "**/Directory.Build.props"
  - "**/Directory.Build.targets"
---

# C# Hooks

> This file extends [common/hooks.md](../common/hooks.md) with C#-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **dotnet format**: Auto-format edited C# files and apply analyzer fixes
- **dotnet build**: Verify the solution or project still compiles after edits
- **dotnet test --no-build**: Re-run the nearest relevant test project after behavior changes

## Stop Hooks

- Run a final `dotnet build` before ending a session with broad C# changes
- Warn on modified `appsettings*.json` files so secrets do not get committed
---

## Rule: csharp/patterns
---

paths:
  - "**/*.cs"
  - "**/*.csx"
---

# C# Patterns

> This file extends [common/patterns.md](../common/patterns.md) with C#-specific content.

## API Response Pattern

```csharp
public sealed record ApiResponse<T>(
    bool Success,
    T? Data = default,
    string? Error = null,
    object? Meta = null);
```

## Repository Pattern

```csharp
public interface IRepository<T>
{
    Task<IReadOnlyList<T>> FindAllAsync(CancellationToken cancellationToken);
    Task<T?> FindByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<T> CreateAsync(T entity, CancellationToken cancellationToken);
    Task<T> UpdateAsync(T entity, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
```

## Options Pattern

Use strongly typed options for config instead of reading raw strings throughout the codebase.

```csharp
public sealed class PaymentsOptions
{
    public const string SectionName = "Payments";
    public required string BaseUrl { get; init; }
    public required string ApiKeySecretName { get; init; }
}
```

## Dependency Injection

- Depend on interfaces at service boundaries
- Keep constructors focused; if a service needs too many dependencies, split responsibilities
- Register lifetimes intentionally: singleton for stateless/shared services, scoped for request data, transient for lightweight pure workers
---

## Rule: csharp/security
---

paths:
  - "**/*.cs"
  - "**/*.csx"
  - "**/*.csproj"
  - "***.json"
---

# C# Security

> This file extends [common/security.md](../common/security.md) with C#-specific content.

## Secret Management

- Never hardcode API keys, tokens, or connection strings in source code
- Use environment variables, user secrets for local development, and a secret manager in production
- Keep `appsettings.*.json` free of real credentials

```csharp
// BAD
const string ApiKey = "sk-live-123";

// GOOD
var apiKey = builder.Configuration["OpenAI:ApiKey"]
    ?? throw new InvalidOperationException("OpenAI:ApiKey is not configured.");
```

## SQL Injection Prevention

- Always use parameterized queries with ADO.NET, Dapper, or EF Core
- Never concatenate user input into SQL strings
- Validate sort fields and filter operators before using dynamic query composition

```csharp
const string sql = "SELECT * FROM Orders WHERE CustomerId = @customerId";
await connection.QueryAsync<Order>(sql, new { customerId });
```

## Input Validation

- Validate DTOs at the application boundary
- Use data annotations, FluentValidation, or explicit guard clauses
- Reject invalid model state before running business logic

## Authentication and Authorization

- Prefer framework auth handlers instead of custom token parsing
- Enforce authorization policies at endpoint or handler boundaries
- Never log raw tokens, passwords, or PII

## Error Handling

- Return safe client-facing messages
- Log detailed exceptions with structured context server-side
- Do not expose stack traces, SQL text, or filesystem paths in API responses

## References

See skill: `security-review` for broader application security review checklists.
---

## Rule: csharp/testing
---

paths:
  - "**/*.cs"
  - "**/*.csx"
  - "**/*.csproj"
---

# C# Testing

> This file extends [common/testing.md](../common/testing.md) with C#-specific content.

## Test Framework

- Prefer **xUnit** for unit and integration tests
- Use **FluentAssertions** for readable assertions
- Use **Moq** or **NSubstitute** for mocking dependencies
- Use **Testcontainers** when integration tests need real infrastructure

## Test Organization

- Mirror `src/` structure under `tests/`
- Separate unit, integration, and end-to-end coverage clearly
- Name tests by behavior, not implementation details

```csharp
public sealed class OrderServiceTests
{
    [Fact]
    public async Task FindByIdAsync_ReturnsOrder_WhenOrderExists()
    {
        // Arrange
        // Act
        // Assert
    }
}
```

## ASP.NET Core Integration Tests

- Use `WebApplicationFactory<TEntryPoint>` for API integration coverage
- Test auth, validation, and serialization through HTTP, not by bypassing middleware

## Coverage

- Target 80%+ line coverage
- Focus coverage on domain logic, validation, auth, and failure paths
- Run `dotnet test` in CI with coverage collection enabled where available
---

## Rule: dart/coding-style
---

paths:
  - "**/*.dart"
  - "**/pubspec.yaml"
  - "**/analysis_options.yaml"
---

# Dart/Flutter Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Dart and Flutter-specific content.

## Formatting

- **dart format** for all `.dart` files — enforced in CI (`dart format --set-exit-if-changed .`)
- Line length: 80 characters (dart format default)
- Trailing commas on multi-line argument/parameter lists to improve diffs and formatting

## Immutability

- Prefer `final` for local variables and `const` for compile-time constants
- Use `const` constructors wherever all fields are `final`
- Return unmodifiable collections from public APIs (`List.unmodifiable`, `Map.unmodifiable`)
- Use `copyWith()` for state mutations in immutable state classes

```dart
// BAD
var count = 0;
List<String> items = ['a', 'b'];

// GOOD
final count = 0;
const items = ['a', 'b'];
```

## Naming

Follow Dart conventions:
- `camelCase` for variables, parameters, and named constructors
- `PascalCase` for classes, enums, typedefs, and extensions
- `snake_case` for file names and library names
- `SCREAMING_SNAKE_CASE` for constants declared with `const` at top level
- Prefix private members with `_`
- Extension names describe the type they extend: `StringExtensions`, not `MyHelpers`

## Null Safety

- Avoid `!` (bang operator) — prefer `?.`, `??`, `if (x != null)`, or Dart 3 pattern matching; reserve `!` only where a null value is a programming error and crashing is the right behaviour
- Avoid `late` unless initialization is guaranteed before first use (prefer nullable or constructor init)
- Use `required` for constructor parameters that must always be provided

```dart
// BAD — crashes at runtime if user is null
final name = user!.name;

// GOOD — null-aware operators
final name = user?.name ?? 'Unknown';

// GOOD — Dart 3 pattern matching (exhaustive, compiler-checked)
final name = switch (user) {
  User(:final name) => name,
  null => 'Unknown',
};

// GOOD — early-return null guard
String getUserName(User? user) {
  if (user == null) return 'Unknown';
  return user.name; // promoted to non-null after the guard
}
```

## Sealed Types and Pattern Matching (Dart 3+)

Use sealed classes to model closed state hierarchies:

```dart
sealed class AsyncState<T> {
  const AsyncState();
}

final class Loading<T> extends AsyncState<T> {
  const Loading();
}

final class Success<T> extends AsyncState<T> {
  const Success(this.data);
  final T data;
}

final class Failure<T> extends AsyncState<T> {
  const Failure(this.error);
  final Object error;
}
```

Always use exhaustive `switch` with sealed types — no default/wildcard:

```dart
// BAD
if (state is Loading) { ... }

// GOOD
return switch (state) {
  Loading() => const CircularProgressIndicator(),
  Success(:final data) => DataWidget(data),
  Failure(:final error) => ErrorWidget(error.toString()),
};
```

## Error Handling

- Specify exception types in `on` clauses — never use bare `catch (e)`
- Never catch `Error` subtypes — they indicate programming bugs
- Use `Result`-style types or sealed classes for recoverable errors
- Avoid using exceptions for control flow

```dart
// BAD
try {
  await fetchUser();
} catch (e) {
  log(e.toString());
}

// GOOD
try {
  await fetchUser();
} on NetworkException catch (e) {
  log('Network error: ${e.message}');
} on NotFoundException {
  handleNotFound();
}
```

## Async / Futures

- Always `await` Futures or explicitly call `unawaited()` to signal intentional fire-and-forget
- Never mark a function `async` if it never `await`s anything
- Use `Future.wait` / `Future.any` for concurrent operations
- Check `context.mounted` before using `BuildContext` after any `await` (Flutter 3.7+)

```dart
// BAD — ignoring Future
fetchData(); // fire-and-forget without marking intent

// GOOD
unawaited(fetchData()); // explicit fire-and-forget
await fetchData();      // or properly awaited
```

## Imports

- Use `package:` imports throughout — never relative imports (`../`) for cross-feature or cross-layer code
- Order: `dart:` → external `package:` → internal `package:` (same package)
- No unused imports — `dart analyze` enforces this with `unused_import`

## Code Generation

- Generated files (`.g.dart`, `.freezed.dart`, `.gr.dart`) must be committed or gitignored consistently — pick one strategy per project
- Never manually edit generated files
- Keep generator annotations (`@JsonSerializable`, `@freezed`, `@riverpod`, etc.) on the canonical source file only
---

## Rule: dart/hooks
---

paths:
  - "**/*.dart"
  - "**/pubspec.yaml"
  - "**/analysis_options.yaml"
---

# Dart/Flutter Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Dart and Flutter-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **dart format**: Auto-format `.dart` files after edit
- **dart analyze**: Run static analysis after editing Dart files and surface warnings
- **flutter test**: Optionally run affected tests after significant changes

## Recommended Hook Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": { "tool_name": "Edit", "file_paths": ["**/*.dart"] },
        "hooks": [
          { "type": "command", "command": "dart format $CLAUDE_FILE_PATHS" }
        ]
      }
    ]
  }
}
```

## Pre-commit Checks

Run before committing Dart/Flutter changes:

```bash
dart format --set-exit-if-changed .
dart analyze --fatal-infos
flutter test
```

## Useful One-liners

```bash
# Format all Dart files
dart format .

# Analyze and report issues
dart analyze

# Run all tests with coverage
flutter test --coverage

# Regenerate code-gen files
dart run build_runner build --delete-conflicting-outputs

# Check for outdated packages
flutter pub outdated

# Upgrade packages within constraints
flutter pub upgrade
```
---

## Rule: dart/patterns
---

paths:
  - "**/*.dart"
  - "**/pubspec.yaml"
---

# Dart/Flutter Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Dart, Flutter, and common ecosystem-specific content.

## Repository Pattern

```dart
abstract interface class UserRepository {
  Future<User?> getById(String id);
  Future<List<User>> getAll();
  Stream<List<User>> watchAll();
  Future<void> save(User user);
  Future<void> delete(String id);
}

class UserRepositoryImpl implements UserRepository {
  const UserRepositoryImpl(this._remote, this._local);

  final UserRemoteDataSource _remote;
  final UserLocalDataSource _local;

  @override
  Future<User?> getById(String id) async {
    final local = await _local.getById(id);
    if (local != null) return local;
    final remote = await _remote.getById(id);
    if (remote != null) await _local.save(remote);
    return remote;
  }

  @override
  Future<List<User>> getAll() async {
    final remote = await _remote.getAll();
    for (final user in remote) {
      await _local.save(user);
    }
    return remote;
  }

  @override
  Stream<List<User>> watchAll() => _local.watchAll();

  @override
  Future<void> save(User user) => _local.save(user);

  @override
  Future<void> delete(String id) async {
    await _remote.delete(id);
    await _local.delete(id);
  }
}
```

## State Management: BLoC/Cubit

```dart
// Cubit — simple state transitions
class CounterCubit extends Cubit<int> {
  CounterCubit() : super(0);

  void increment() => emit(state + 1);
  void decrement() => emit(state - 1);
}

// BLoC — event-driven
@immutable
sealed class CartEvent {}
class CartItemAdded extends CartEvent { CartItemAdded(this.item); final Item item; }
class CartItemRemoved extends CartEvent { CartItemRemoved(this.id); final String id; }
class CartCleared extends CartEvent {}

@immutable
class CartState {
  const CartState({this.items = const []});
  final List<Item> items;
  CartState copyWith({List<Item>? items}) => CartState(items: items ?? this.items);
}

class CartBloc extends Bloc<CartEvent, CartState> {
  CartBloc() : super(const CartState()) {
    on<CartItemAdded>((event, emit) =>
        emit(state.copyWith(items: [...state.items, event.item])));
    on<CartItemRemoved>((event, emit) =>
        emit(state.copyWith(items: state.items.where((i) => i.id != event.id).toList())));
    on<CartCleared>((_, emit) => emit(const CartState()));
  }
}
```

## State Management: Riverpod

```dart
// Simple provider
@riverpod
Future<List<User>> users(Ref ref) async {
  final repo = ref.watch(userRepositoryProvider);
  return repo.getAll();
}

// Notifier for mutable state
@riverpod
class CartNotifier extends _$CartNotifier {
  @override
  List<Item> build() => [];

  void add(Item item) => state = [...state, item];
  void remove(String id) => state = state.where((i) => i.id != id).toList();
  void clear() => state = [];
}

// ConsumerWidget
class CartPage extends ConsumerWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(cartNotifierProvider);
    return ListView(
      children: items.map((item) => CartItemTile(item: item)).toList(),
    );
  }
}
```

## Dependency Injection

Constructor injection is preferred. Use `get_it` or Riverpod providers at composition root:

```dart
// get_it registration (in a setup file)
void setupDependencies() {
  final di = GetIt.instance;
  di.registerSingleton<ApiClient>(ApiClient(baseUrl: Env.apiUrl));
  di.registerSingleton<UserRepository>(
    UserRepositoryImpl(di<ApiClient>(), di<LocalDatabase>()),
  );
  di.registerFactory(() => UserListViewModel(di<UserRepository>()));
}
```

## ViewModel Pattern (without BLoC/Riverpod)

```dart
class UserListViewModel extends ChangeNotifier {
  UserListViewModel(this._repository);

  final UserRepository _repository;

  AsyncState<List<User>> _state = const Loading();
  AsyncState<List<User>> get state => _state;

  Future<void> load() async {
    _state = const Loading();
    notifyListeners();
    try {
      final users = await _repository.getAll();
      _state = Success(users);
    } on Exception catch (e) {
      _state = Failure(e);
    }
    notifyListeners();
  }
}
```

## UseCase Pattern

```dart
class GetUserUseCase {
  const GetUserUseCase(this._repository);
  final UserRepository _repository;

  Future<User?> call(String id) => _repository.getById(id);
}

class CreateUserUseCase {
  const CreateUserUseCase(this._repository, this._idGenerator);
  final UserRepository _repository;
  final IdGenerator _idGenerator; // injected — domain layer must not depend on uuid package directly

  Future<void> call(CreateUserInput input) async {
    // Validate, apply business rules, then persist
    final user = User(id: _idGenerator.generate(), name: input.name, email: input.email);
    await _repository.save(user);
  }
}
```

## Immutable State with freezed

```dart
@freezed
class UserState with _$UserState {
  const factory UserState({
    @Default([]) List<User> users,
    @Default(false) bool isLoading,
    String? errorMessage,
  }) = _UserState;
}
```

## Clean Architecture Layer Boundaries

```
lib/
├── domain/              # Pure Dart — no Flutter, no external packages
│   ├── entities/
│   ├── repositories/    # Abstract interfaces
│   └── usecases/
├── data/                # Implements domain interfaces
│   ├── datasources/
│   ├── models/          # DTOs with fromJson/toJson
│   └── repositories/
└── presentation/        # Flutter widgets + state management
    ├── pages/
    ├── widgets/
    └── providers/ (or blocs/ or viewmodels/)
```

- Domain must not import `package:flutter` or any data-layer package
- Data layer maps DTOs to domain entities at repository boundaries
- Presentation calls use cases, not repositories directly

## Navigation (GoRouter)

```dart
final router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomePage(),
    ),
    GoRoute(
      path: '/users/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return UserDetailPage(userId: id);
      },
    ),
  ],
  // refreshListenable re-evaluates redirect whenever auth state changes
  refreshListenable: GoRouterRefreshStream(authCubit.stream),
  redirect: (context, state) {
    final isLoggedIn = context.read<AuthCubit>().state is AuthAuthenticated;
    if (!isLoggedIn && !state.matchedLocation.startsWith('/login')) {
      return '/login';
    }
    return null;
  },
);
```

## References

See skill: `flutter-dart-code-review` for the comprehensive review checklist.
See skill: `compose-multiplatform-patterns` for Kotlin Multiplatform/Flutter interop patterns.
---

## Rule: dart/security
---

paths:
  - "**/*.dart"
  - "**/pubspec.yaml"
  - "**/AndroidManifest.xml"
  - "**/Info.plist"
---

# Dart/Flutter Security

> This file extends [common/security.md](../common/security.md) with Dart, Flutter, and mobile-specific content.

## Secrets Management

- Never hardcode API keys, tokens, or credentials in Dart source
- Use `--dart-define` or `--dart-define-from-file` for compile-time config (values are not truly secret — use a backend proxy for server-side secrets)
- Use `flutter_dotenv` or equivalent, with `.env` files listed in `.gitignore`
- Store runtime secrets in platform-secure storage: `flutter_secure_storage` (Keychain on iOS, EncryptedSharedPreferences on Android)

```dart
// BAD
const apiKey = 'sk-abc123...';

// GOOD — compile-time config (not secret, just configurable)
const apiKey = String.fromEnvironment('API_KEY');

// GOOD — runtime secret from secure storage
final token = await secureStorage.read(key: 'auth_token');
```

## Network Security

- Enforce HTTPS — no `http://` calls in production
- Configure Android `network_security_config.xml` to block cleartext traffic
- Set `NSAppTransportSecurity` in `Info.plist` to disallow arbitrary loads
- Set request timeouts on all HTTP clients — never leave defaults
- Consider certificate pinning for high-security endpoints

```dart
// Dio with timeout and HTTPS enforcement
final dio = Dio(BaseOptions(
  baseUrl: 'https://api.example.com',
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 30),
));
```

## Input Validation

- Validate and sanitize all user input before sending to API or storage
- Never pass unsanitized input to SQL queries — use parameterized queries (sqflite, drift)
- Sanitize deep link URLs before navigation — validate scheme, host, and path parameters
- Use `Uri.tryParse` and validate before navigating

```dart
// BAD — SQL injection
await db.rawQuery("SELECT * FROM users WHERE email = '$userInput'");

// GOOD — parameterized
await db.query('users', where: 'email = ?', whereArgs: [userInput]);

// BAD — unvalidated deep link
final uri = Uri.parse(incomingLink);
context.go(uri.path); // could navigate to any route

// GOOD — validated deep link
final uri = Uri.tryParse(incomingLink);
if (uri != null && uri.host == 'myapp.com' && _allowedPaths.contains(uri.path)) {
  context.go(uri.path);
}
```

## Data Protection

- Store tokens, PII, and credentials only in `flutter_secure_storage`
- Never write sensitive data to `SharedPreferences` or local files in plaintext
- Clear auth state on logout: tokens, cached user data, cookies
- Use biometric authentication (`local_auth`) for sensitive operations
- Avoid logging sensitive data — no `print(token)` or `debugPrint(password)`

## Android-Specific

- Declare only required permissions in `AndroidManifest.xml`
- Export Android components (`Activity`, `Service`, `BroadcastReceiver`) only when necessary; add `android:exported="false"` where not needed
- Review intent filters — exported components with implicit intent filters are accessible by any app
- Use `FLAG_SECURE` for screens displaying sensitive data (prevents screenshots)

```xml
<!-- AndroidManifest.xml — restrict exported components -->
<activity android:name=".MainActivity" android:exported="true">
    <!-- Only the launcher activity needs exported=true -->
</activity>
<activity android:name=".SensitiveActivity" android:exported="false" />
```

## iOS-Specific

- Declare only required usage descriptions in `Info.plist` (`NSCameraUsageDescription`, etc.)
- Store secrets in Keychain — `flutter_secure_storage` uses Keychain on iOS
- Use App Transport Security (ATS) — disallow arbitrary loads
- Enable data protection entitlement for sensitive files

## WebView Security

- Use `webview_flutter` v4+ (`WebViewController` / `WebViewWidget`) — the legacy `WebView` widget is removed
- Disable JavaScript unless explicitly required (`JavaScriptMode.disabled`)
- Validate URLs before loading — never load arbitrary URLs from deep links
- Never expose Dart callbacks to JavaScript unless absolutely needed and carefully sandboxed
- Use `NavigationDelegate.onNavigationRequest` to intercept and validate navigation requests

```dart
// webview_flutter v4+ API (WebViewController + WebViewWidget)
final controller = WebViewController()
  ..setJavaScriptMode(JavaScriptMode.disabled) // disabled unless required
  ..setNavigationDelegate(
    NavigationDelegate(
      onNavigationRequest: (request) {
        final uri = Uri.tryParse(request.url);
        if (uri == null || uri.host != 'trusted.example.com') {
          return NavigationDecision.prevent;
        }
        return NavigationDecision.navigate;
      },
    ),
  );

// In your widget tree:
WebViewWidget(controller: controller)
```

## Obfuscation and Build Security

- Enable obfuscation in release builds: `flutter build apk --obfuscate --split-debug-info=.`
- Keep `--split-debug-info` output out of version control (used for crash symbolication only)
- Ensure ProGuard/R8 rules don't inadvertently expose serialized classes
- Run `flutter analyze` and address all warnings before release
---

## Rule: dart/testing
---

paths:
  - "**/*.dart"
  - "**/pubspec.yaml"
  - "**/analysis_options.yaml"
---

# Dart/Flutter Testing

> This file extends [common/testing.md](../common/testing.md) with Dart and Flutter-specific content.

## Test Framework

- **flutter_test** / **dart:test** — built-in test runner
- **mockito** (with `@GenerateMocks`) or **mocktail** (no codegen) for mocking
- **bloc_test** for BLoC/Cubit unit tests
- **fake_async** for controlling time in unit tests
- **integration_test** for end-to-end device tests

## Test Types

| Type | Tool | Location | When to Write |
|------|------|----------|---------------|
| Unit | `dart:test` | `test/unit/` | All domain logic, state managers, repositories |
| Widget | `flutter_test` | `test/widget/` | All widgets with meaningful behavior |
| Golden | `flutter_test` | `test/golden/` | Design-critical UI components |
| Integration | `integration_test` | `integration_test/` | Critical user flows on real device/emulator |

## Unit Tests: State Managers

### BLoC with `bloc_test`

```dart
group('CartBloc', () {
  late CartBloc bloc;
  late MockCartRepository repository;

  setUp(() {
    repository = MockCartRepository();
    bloc = CartBloc(repository);
  });

  tearDown(() => bloc.close());

  blocTest<CartBloc, CartState>(
    'emits updated items when CartItemAdded',
    build: () => bloc,
    act: (b) => b.add(CartItemAdded(testItem)),
    expect: () => [CartState(items: [testItem])],
  );

  blocTest<CartBloc, CartState>(
    'emits empty cart when CartCleared',
    seed: () => CartState(items: [testItem]),
    build: () => bloc,
    act: (b) => b.add(CartCleared()),
    expect: () => [const CartState()],
  );
});
```

### Riverpod with `ProviderContainer`

```dart
test('usersProvider loads users from repository', () async {
  final container = ProviderContainer(
    overrides: [userRepositoryProvider.overrideWithValue(FakeUserRepository())],
  );
  addTearDown(container.dispose);

  final result = await container.read(usersProvider.future);
  expect(result, isNotEmpty);
});
```

## Widget Tests

```dart
testWidgets('CartPage shows item count badge', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        cartNotifierProvider.overrideWith(() => FakeCartNotifier([testItem])),
      ],
      child: const MaterialApp(home: CartPage()),
    ),
  );

  await tester.pump();
  expect(find.text('1'), findsOneWidget);
  expect(find.byType(CartItemTile), findsOneWidget);
});

testWidgets('shows empty state when cart is empty', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [cartNotifierProvider.overrideWith(() => FakeCartNotifier([]))],
      child: const MaterialApp(home: CartPage()),
    ),
  );

  await tester.pump();
  expect(find.text('Your cart is empty'), findsOneWidget);
});
```

## Fakes Over Mocks

Prefer hand-written fakes for complex dependencies:

```dart
class FakeUserRepository implements UserRepository {
  final _users = <String, User>{};
  Object? fetchError;

  @override
  Future<User?> getById(String id) async {
    if (fetchError != null) throw fetchError!;
    return _users[id];
  }

  @override
  Future<List<User>> getAll() async {
    if (fetchError != null) throw fetchError!;
    return _users.values.toList();
  }

  @override
  Stream<List<User>> watchAll() => Stream.value(_users.values.toList());

  @override
  Future<void> save(User user) async {
    _users[user.id] = user;
  }

  @override
  Future<void> delete(String id) async {
    _users.remove(id);
  }

  void addUser(User user) => _users[user.id] = user;
}
```

## Async Testing

```dart
// Use fake_async for controlling timers and Futures
test('debounce triggers after 300ms', () {
  fakeAsync((async) {
    final debouncer = Debouncer(delay: const Duration(milliseconds: 300));
    var callCount = 0;
    debouncer.run(() => callCount++);
    expect(callCount, 0);
    async.elapse(const Duration(milliseconds: 200));
    expect(callCount, 0);
    async.elapse(const Duration(milliseconds: 200));
    expect(callCount, 1);
  });
});
```

## Golden Tests

```dart
testWidgets('UserCard golden test', (tester) async {
  await tester.pumpWidget(
    MaterialApp(home: UserCard(user: testUser)),
  );

  await expectLater(
    find.byType(UserCard),
    matchesGoldenFile('goldens/user_card.png'),
  );
});
```

Run `flutter test --update-goldens` when intentional visual changes are made.

## Test Naming

Use descriptive, behavior-focused names:

```dart
test('returns null when user does not exist', () { ... });
test('throws NotFoundException when id is empty string', () { ... });
testWidgets('disables submit button while form is invalid', (tester) async { ... });
```

## Test Organization

```
test/
├── unit/
│   ├── domain/
│   │   └── usecases/
│   └── data/
│       └── repositories/
├── widget/
│   └── presentation/
│       └── pages/
└── golden/
    └── widgets/

integration_test/
└── flows/
    ├── login_flow_test.dart
    └── checkout_flow_test.dart
```

## Coverage

- Target 80%+ line coverage for business logic (domain + state managers)
- All state transitions must have tests: loading → success, loading → error, retry
- Run `flutter test --coverage` and inspect `lcov.info` with a coverage reporter
- Coverage failures should block CI when below threshold
---

## Rule: development-rules

# Development Rules

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You ALWAYS follow these principles: **YAGNI (You Aren't Gonna Need It) - KISS (Keep It Simple, Stupid) - DRY (Don't Repeat Yourself)**

## General
- **File Naming**: Use kebab-case for file names with a meaningful name that describes the purpose of the file, doesn't matter if the file name is long, just make sure when LLMs read the file names while using Grep or other tools, they can understand the purpose of the file right away without reading the file content.
- **File Size Management**: Keep individual code files under 200 lines for optimal context management
  - Split large files into smaller, focused components/modules
  - Use composition over inheritance for complex widgets
  - Extract utility functions into separate modules
  - Create dedicated service classes for business logic
- When looking for docs, activate `docs-seeker` skill (`context7` reference) for exploring latest docs.
- Use `gh` bash command to interact with Github features if needed
- Use `psql` bash command to query Postgres database for debugging if needed
- Use `ai-multimodal` skill for describing details of images, videos, documents, etc. if needed
- Use `ai-multimodal` skill and `imagemagick` skill for generating and editing images, videos, documents, etc. if needed
- Use `sequential-thinking` and `debug` skills for sequential thinking, analyzing code, debugging, etc. if needed
- **[IMPORTANT]** Follow the codebase structure and code standards in `.` during implementation.
- **[IMPORTANT]** Do not just simulate the implementation or mocking them, always implement the real code.

## Code Quality Guidelines
- Read and follow codebase structure and code standards in `.`
- Don't be too harsh on code linting, but **make sure there are no syntax errors and code are compilable**
- Prioritize functionality and readability over strict style enforcement and code formatting
- Use reasonable code quality standards that enhance developer productivity
- Use try catch error handling & cover security standards
- Use `code-reviewer` agent to review code after every implementation

## Pre-commit/Push Rules
- Run linting before commit
- Run tests before push (DO NOT ignore failed tests just to pass the build or github actions)
- Keep commits focused on the actual code changes
- **DO NOT** commit and push any confidential information (such as dotenv files, API keys, database credentials, etc.) to git repository!
- Create clean, professional commit messages without AI references. Use conventional commit format.

## Code Implementation
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.

## Visual Aids
- Use ` --explain` when explaining unfamiliar code patterns or complex logic
- Use ` --diagram` for architecture diagrams and data flow visualization
- Use ` --slides` for step-by-step walkthroughs and presentations
- Use ` --ascii` for terminal-friendly diagrams (no browser needed to understand)
- Add `--html` to any generation flag for self-contained HTML output (opens in browser, no server needed)
- **Plan context:** Active plan determined from `## Plan Context` in hook injection; visuals save to `{plan_dir}`
- If no active plan, fallback to `plans/visuals/` directory
- For Mermaid diagrams, use `` skill for v11 syntax rules
- See `primary-workflow.md` → Step 6 for workflow integration
---

## Rule: documentation-management

# Project Documentation Management

### Roadmap & Changelog Maintenance
- **Project Roadmap** (`./docs/development-roadmap.md`): Living document tracking project phases, milestones, and progress
- **Project Changelog** (`./docs/project-changelog.md`): Detailed record of all significant changes, features, and fixes
- **System Architecture** (`./docs/system-architecture.md`): Detailed record of all significant changes, features, and fixes
- **Code Standards** (`./docs/code-standards.md`): Detailed record of all significant changes, features, and fixes

### Automatic Updates Required
- **After Feature Implementation**: Update roadmap progress status and changelog entries
- **After Major Milestones**: Review and adjust roadmap phases, update success metrics
- **After Bug Fixes**: Document fixes in changelog with severity and impact
- **After Security Updates**: Record security improvements and version updates
- **Weekly Reviews**: Update progress percentages and milestone statuses

### Documentation Triggers
The `project-manager` agent MUST update these documents when:
- A development phase status changes (e.g., from "In Progress" to "Complete")
- Major features are implemented or released
- Significant bugs are resolved or security patches applied
- Project timeline or scope adjustments are made
- External dependencies or breaking changes occur

### Update Protocol
1. **Before Updates**: Always read current roadmap and changelog status
2. **During Updates**: Maintain version consistency and proper formatting
3. **After Updates**: Verify links, dates, and cross-references are accurate
4. **Quality Check**: Ensure updates align with actual implementation progress

### Plans

### Plan Location
Save plans in `.` directory with timestamp and descriptive name.

**Format:** Use naming pattern from `## Naming` section injected by hooks.

**Example:** `plans/251101-1505-authentication-and-profile-implementation/`

#### File Organization

```
plans/
├── 20251101-1505-authentication-and-profile-implementation/
    ├── research/
    │   ├── researcher-XX-report.md
    │   └── ...
│   ├── reports/
│   │   ├── scout-report.md
│   │   ├── researcher-report.md
│   │   └── ...
│   ├── plan.md                                # Overview access point
│   ├── phase-01-setup-environment.md          # Setup environment
│   ├── phase-02-implement-database.md         # Database models
│   ├── phase-03-implement-api-endpoints.md    # API endpoints
│   ├── phase-04-implement-ui-components.md    # UI components
│   ├── phase-05-implement-authentication.md   # Auth & authorization
│   ├── phase-06-implement-profile.md          # Profile page
│   └── phase-07-write-tests.md                # Tests
└── ...
```

#### File Structure

##### Overview Plan (plan.md)
- Keep generic and under 80 lines
- List each phase with status/progress
- Link to detailed phase files
- Key dependencies

##### Phase Files (phase-XX-name.md)
Fully respect the `./docs/development-rules.md` file.
Each phase file should contain:

**Context Links**
- Links to related reports, files, documentation

**Overview**
- Priority
- Current status
- Brief description

**Key Insights**
- Important findings from research
- Critical considerations

**Requirements**
- Functional requirements
- Non-functional requirements

**Architecture**
- System design
- Component interactions
- Data flow

**Related Code Files**
- List of files to modify
- List of files to create
- List of files to delete

**Implementation Steps**
- Detailed, numbered steps
- Specific instructions

**Todo List**
- Checkbox list for tracking

**Success Criteria**
- Definition of done
- Validation methods

**Risk Assessment**
- Potential issues
- Mitigation strategies

**Security Considerations**
- Auth/authorization
- Data protection

**Next Steps**
- Dependencies
- Follow-up tasks
---

## Rule: golang/coding-style
---

paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Go specific content.

## Formatting

- **gofmt** and **goimports** are mandatory — no style debates

## Design Principles

- Accept interfaces, return structs
- Keep interfaces small (1-3 methods)

## Error Handling

Always wrap errors with context:

```go
if err != nil {
    return fmt.Errorf("failed to create user: %w", err)
}
```

## Reference

See skill: `golang-patterns` for comprehensive Go idioms and patterns.
---

## Rule: golang/hooks
---

paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Go specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **gofmt/goimports**: Auto-format `.go` files after edit
- **go vet**: Run static analysis after editing `.go` files
- **staticcheck**: Run extended static checks on modified packages
---

## Rule: golang/patterns
---

paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Go specific content.

## Functional Options

```go
type Option func(*Server)

func WithPort(port int) Option {
    return func(s *Server) { s.port = port }
}

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080}
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

## Small Interfaces

Define interfaces where they are used, not where they are implemented.

## Dependency Injection

Use constructor functions to inject dependencies:

```go
func NewUserService(repo UserRepository, logger Logger) *UserService {
    return &UserService{repo: repo, logger: logger}
}
```

## Reference

See skill: `golang-patterns` for comprehensive Go patterns including concurrency, error handling, and package organization.
---

## Rule: golang/security
---

paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Security

> This file extends [common/security.md](../common/security.md) with Go specific content.

## Secret Management

```go
apiKey := os.Getenv("OPENAI_API_KEY")
if apiKey == "" {
    log.Fatal("OPENAI_API_KEY not configured")
}
```

## Security Scanning

- Use **gosec** for static security analysis:
  ```bash
  gosec ./...
  ```

## Context & Timeouts

Always use `context.Context` for timeout control:

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
```
---

## Rule: golang/testing
---

paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Testing

> This file extends [common/testing.md](../common/testing.md) with Go specific content.

## Framework

Use the standard `go test` with **table-driven tests**.

## Race Detection

Always run with the `-race` flag:

```bash
go test -race ./...
```

## Coverage

```bash
go test -cover ./...
```

## Reference

See skill: `golang-testing` for detailed Go testing patterns and helpers.
---

## Rule: java/coding-style
---

paths:
  - "**/*.java"
---

# Java Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Java-specific content.

## Formatting

- **google-java-format** or **Checkstyle** (Google or Sun style) for enforcement
- One public top-level type per file
- Consistent indent: 2 or 4 spaces (match project standard)
- Member order: constants, fields, constructors, public methods, protected, private

## Immutability

- Prefer `record` for value types (Java 16+)
- Mark fields `final` by default — use mutable state only when required
- Return defensive copies from public APIs: `List.copyOf()`, `Map.copyOf()`, `Set.copyOf()`
- Copy-on-write: return new instances rather than mutating existing ones

```java
// GOOD — immutable value type
public record OrderSummary(Long id, String customerName, BigDecimal total) {}

// GOOD — final fields, no setters
public class Order {
    private final Long id;
    private final List<LineItem> items;

    public List<LineItem> getItems() {
        return List.copyOf(items);
    }
}
```

## Naming

Follow standard Java conventions:
- `PascalCase` for classes, interfaces, records, enums
- `camelCase` for methods, fields, parameters, local variables
- `SCREAMING_SNAKE_CASE` for `static final` constants
- Packages: all lowercase, reverse domain (`com.example.app.service`)

## Modern Java Features

Use modern language features where they improve clarity:
- **Records** for DTOs and value types (Java 16+)
- **Sealed classes** for closed type hierarchies (Java 17+)
- **Pattern matching** with `instanceof` — no explicit cast (Java 16+)
- **Text blocks** for multi-line strings — SQL, JSON templates (Java 15+)
- **Switch expressions** with arrow syntax (Java 14+)
- **Pattern matching in switch** — exhaustive sealed type handling (Java 21+)

```java
// Pattern matching instanceof
if (shape instanceof Circle c) {
    return Math.PI * c.radius() * c.radius();
}

// Sealed type hierarchy
public sealed interface PaymentMethod permits CreditCard, BankTransfer, Wallet {}

// Switch expression
String label = switch (status) {
    case ACTIVE -> "Active";
    case SUSPENDED -> "Suspended";
    case CLOSED -> "Closed";
};
```

## Optional Usage

- Return `Optional<T>` from finder methods that may have no result
- Use `map()`, `flatMap()`, `orElseThrow()` — never call `get()` without `isPresent()`
- Never use `Optional` as a field type or method parameter

```java
// GOOD
return repository.findById(id)
    .map(ResponseDto::from)
    .orElseThrow(() -> new OrderNotFoundException(id));

// BAD — Optional as parameter
public void process(Optional<String> name) {}
```

## Error Handling

- Prefer unchecked exceptions for domain errors
- Create domain-specific exceptions extending `RuntimeException`
- Avoid broad `catch (Exception e)` unless at top-level handlers
- Include context in exception messages

```java
public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(Long id) {
        super("Order not found: id=" + id);
    }
}
```

## Streams

- Use streams for transformations; keep pipelines short (3-4 operations max)
- Prefer method references when readable: `.map(Order::getTotal)`
- Avoid side effects in stream operations
- For complex logic, prefer a loop over a convoluted stream pipeline

## References

See skill: `java-coding-standards` for full coding standards with examples.
See skill: `jpa-patterns` for JPA/Hibernate entity design patterns.
---

## Rule: java/hooks
---

paths:
  - "**/*.java"
  - "**/pom.xml"
  - "**/build.gradle"
  - "**/build.gradle.kts"
---

# Java Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Java-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **google-java-format**: Auto-format `.java` files after edit
- **checkstyle**: Run style checks after editing Java files
- **. compile** or **. compileJava**: Verify compilation after changes
---

## Rule: java/patterns
---

paths:
  - "**/*.java"
---

# Java Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Java-specific content.

## Repository Pattern

Encapsulate data access behind an interface:

```java
public interface OrderRepository {
    Optional<Order> findById(Long id);
    List<Order> findAll();
    Order save(Order order);
    void deleteById(Long id);
}
```

Concrete implementations handle storage details (JPA, JDBC, in-memory for tests).

## Service Layer

Business logic in service classes; keep controllers and repositories thin:

```java
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;

    public OrderService(OrderRepository orderRepository, PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
    }

    public OrderSummary placeOrder(CreateOrderRequest request) {
        var order = Order.from(request);
        paymentGateway.charge(order.total());
        var saved = orderRepository.save(order);
        return OrderSummary.from(saved);
    }
}
```

## Constructor Injection

Always use constructor injection — never field injection:

```java
// GOOD — constructor injection (testable, immutable)
public class NotificationService {
    private final EmailSender emailSender;

    public NotificationService(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}

// BAD — field injection (untestable without reflection, requires framework magic)
public class NotificationService {
    @Inject // or @Autowired
    private EmailSender emailSender;
}
```

## DTO Mapping

Use records for DTOs. Map at service/controller boundaries:

```java
public record OrderResponse(Long id, String customer, BigDecimal total) {
    public static OrderResponse from(Order order) {
        return new OrderResponse(order.getId(), order.getCustomerName(), order.getTotal());
    }
}
```

## Builder Pattern

Use for objects with many optional parameters:

```java
public class SearchCriteria {
    private final String query;
    private final int page;
    private final int size;
    private final String sortBy;

    private SearchCriteria(Builder builder) {
        this.query = builder.query;
        this.page = builder.page;
        this.size = builder.size;
        this.sortBy = builder.sortBy;
    }

    public static class Builder {
        private String query = "";
        private int page = 0;
        private int size = 20;
        private String sortBy = "id";

        public Builder query(String query) { this.query = query; return this; }
        public Builder page(int page) { this.page = page; return this; }
        public Builder size(int size) { this.size = size; return this; }
        public Builder sortBy(String sortBy) { this.sortBy = sortBy; return this; }
        public SearchCriteria build() { return new SearchCriteria(this); }
    }
}
```

## Sealed Types for Domain Models

```java
public sealed interface PaymentResult permits PaymentSuccess, PaymentFailure {
    record PaymentSuccess(String transactionId, BigDecimal amount) implements PaymentResult {}
    record PaymentFailure(String errorCode, String message) implements PaymentResult {}
}

// Exhaustive handling (Java 21+)
String message = switch (result) {
    case PaymentSuccess s -> "Paid: " + s.transactionId();
    case PaymentFailure f -> "Failed: " + f.errorCode();
};
```

## API Response Envelope

Consistent API responses:

```java
public record ApiResponse<T>(boolean success, T data, String error) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message);
    }
}
```

## References

See skill: `springboot-patterns` for Spring Boot architecture patterns.
See skill: `jpa-patterns` for entity design and query optimization.
---

## Rule: java/security
---

paths:
  - "**/*.java"
---

# Java Security

> This file extends [common/security.md](../common/security.md) with Java-specific content.

## Secrets Management

- Never hardcode API keys, tokens, or credentials in source code
- Use environment variables: `System.getenv("API_KEY")`
- Use a secret manager (Vault, AWS Secrets Manager) for production secrets
- Keep local config files with secrets in `.gitignore`

```java
// BAD
private static final String API_KEY = "sk-abc123...";

// GOOD — environment variable
String apiKey = System.getenv("PAYMENT_API_KEY");
Objects.requireNonNull(apiKey, "PAYMENT_API_KEY must be set");
```

## SQL Injection Prevention

- Always use parameterized queries — never concatenate user input into SQL
- Use `PreparedStatement` or your framework's parameterized query API
- Validate and sanitize any input used in native queries

```java
// BAD — SQL injection via string concatenation
Statement stmt = conn.createStatement();
String sql = "SELECT * FROM orders WHERE name = '" + name + "'";
stmt.executeQuery(sql);

// GOOD — PreparedStatement with parameterized query
PreparedStatement ps = conn.prepareStatement("SELECT * FROM orders WHERE name = ?");
ps.setString(1, name);

// GOOD — JDBC template
jdbcTemplate.query("SELECT * FROM orders WHERE name = ?", mapper, name);
```

## Input Validation

- Validate all user input at system boundaries before processing
- Use Bean Validation (`@NotNull`, `@NotBlank`, `@Size`) on DTOs when using a validation framework
- Sanitize file paths and user-provided strings before use
- Reject input that fails validation with clear error messages

```java
// Validate manually in plain Java
public Order createOrder(String customerName, BigDecimal amount) {
    if (customerName == null || customerName.isBlank()) {
        throw new IllegalArgumentException("Customer name is required");
    }
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
        throw new IllegalArgumentException("Amount must be positive");
    }
    return new Order(customerName, amount);
}
```

## Authentication and Authorization

- Never implement custom auth crypto — use established libraries
- Store passwords with bcrypt or Argon2, never MD5/SHA1
- Enforce authorization checks at service boundaries
- Clear sensitive data from logs — never log passwords, tokens, or PII

## Dependency Security

- Run `mvn dependency:tree` or `. dependencies` to audit transitive dependencies
- Use OWASP Dependency-Check or Snyk to scan for known CVEs
- Keep dependencies updated — set up Dependabot or Renovate

## Error Messages

- Never expose stack traces, internal paths, or SQL errors in API responses
- Map exceptions to safe, generic client messages at handler boundaries
- Log detailed errors server-side; return generic messages to clients

```java
// Log the detail, return a generic message
try {
    return orderService.findById(id);
} catch (OrderNotFoundException ex) {
    log.warn("Order not found: id={}", id);
    return ApiResponse.error("Resource not found");  // generic, no internals
} catch (Exception ex) {
    log.error("Unexpected error processing order id={}", id, ex);
    return ApiResponse.error("Internal server error");  // never expose ex.getMessage()
}
```

## References

See skill: `springboot-security` for Spring Security authentication and authorization patterns.
See skill: `security-review` for general security checklists.
---

## Rule: java/testing
---

paths:
  - "**/*.java"
---

# Java Testing

> This file extends [common/testing.md](../common/testing.md) with Java-specific content.

## Test Framework

- **JUnit 5** (`@Test`, `@ParameterizedTest`, `@Nested`, `@DisplayName`)
- **AssertJ** for fluent assertions (`assertThat(result).isEqualTo(expected)`)
- **Mockito** for mocking dependencies
- **Testcontainers** for integration tests requiring databases or services

## Test Organization

```
src/test/java/com/example/app/
  service/           # Unit tests for service layer
  controller/        # Web layer / API tests
  repository/        # Data access tests
  integration/       # Cross-layer integration tests
```

Mirror the `src/main/java` package structure in `src/test/java`.

## Unit Test Pattern

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository);
    }

    @Test
    @DisplayName("findById returns order when exists")
    void findById_existingOrder_returnsOrder() {
        var order = new Order(1L, "Alice", BigDecimal.TEN);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        var result = orderService.findById(1L);

        assertThat(result.customerName()).isEqualTo("Alice");
        verify(orderRepository).findById(1L);
    }

    @Test
    @DisplayName("findById throws when order not found")
    void findById_missingOrder_throws() {
        when(orderRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.findById(99L))
            .isInstanceOf(OrderNotFoundException.class)
            .hasMessageContaining("99");
    }
}
```

## Parameterized Tests

```java
@ParameterizedTest
@CsvSource({
    "100.00, 10, 90.00",
    "50.00, 0, 50.00",
    "200.00, 25, 150.00"
})
@DisplayName("discount applied correctly")
void applyDiscount(BigDecimal price, int pct, BigDecimal expected) {
    assertThat(PricingUtils.discount(price, pct)).isEqualByComparingTo(expected);
}
```

## Integration Tests

Use Testcontainers for real database integration:

```java
@Testcontainers
class OrderRepositoryIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    private OrderRepository repository;

    @BeforeEach
    void setUp() {
        var dataSource = new PGSimpleDataSource();
        dataSource.setUrl(postgres.getJdbcUrl());
        dataSource.setUser(postgres.getUsername());
        dataSource.setPassword(postgres.getPassword());
        repository = new JdbcOrderRepository(dataSource);
    }

    @Test
    void save_and_findById() {
        var saved = repository.save(new Order(null, "Bob", BigDecimal.ONE));
        var found = repository.findById(saved.getId());
        assertThat(found).isPresent();
    }
}
```

For Spring Boot integration tests, see skill: `springboot-tdd`.

## Test Naming

Use descriptive names with `@DisplayName`:
- `methodName_scenario_expectedBehavior()` for method names
- `@DisplayName("human-readable description")` for reports

## Coverage

- Target 80%+ line coverage
- Use JaCoCo for coverage reporting
- Focus on service and domain logic — skip trivial getters/config classes

## References

See skill: `springboot-tdd` for Spring Boot TDD patterns with MockMvc and Testcontainers.
See skill: `java-coding-standards` for testing expectations.
---

## Rule: kotlin/coding-style
---

paths:
  - "**/*.kt"
  - "**/*.kts"
---

# Kotlin Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Kotlin-specific content.

## Formatting

- **ktlint** or **Detekt** for style enforcement
- Official Kotlin code style (`kotlin.code.style=official` in `gradle.properties`)

## Immutability

- Prefer `val` over `var` — default to `val` and only use `var` when mutation is required
- Use `data class` for value types; use immutable collections (`List`, `Map`, `Set`) in public APIs
- Copy-on-write for state updates: `state.copy(field = newValue)`

## Naming

Follow Kotlin conventions:
- `camelCase` for functions and properties
- `PascalCase` for classes, interfaces, objects, and type aliases
- `SCREAMING_SNAKE_CASE` for constants (`const val` or `@JvmStatic`)
- Prefix interfaces with behavior, not `I`: `Clickable` not `IClickable`

## Null Safety

- Never use `!!` — prefer `?.`, `?:`, `requireNotNull()`, or `checkNotNull()`
- Use `?.let {}` for scoped null-safe operations
- Return nullable types from functions that can legitimately have no result

```kotlin
// BAD
val name = user!!.name

// GOOD
val name = user?.name ?: "Unknown"
val name = requireNotNull(user) { "User must be set before accessing name" }.name
```

## Sealed Types

Use sealed classes/interfaces to model closed state hierarchies:

```kotlin
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}
```

Always use exhaustive `when` with sealed types — no `else` branch.

## Extension Functions

Use extension functions for utility operations, but keep them discoverable:
- Place in a file named after the receiver type (`StringExt.kt`, `FlowExt.kt`)
- Keep scope limited — don't add extensions to `Any` or overly generic types

## Scope Functions

Use the right scope function:
- `let` — null check + transform: `user?.let { greet(it) }`
- `run` — compute a result using receiver: `service.run { fetch(config) }`
- `apply` — configure an object: `builder.apply { timeout = 30 }`
- `also` — side effects: `result.also { log(it) }`
- Avoid deep nesting of scope functions (max 2 levels)

## Error Handling

- Use `Result<T>` or custom sealed types
- Use `runCatching {}` for wrapping throwable code
- Never catch `CancellationException` — always rethrow it
- Avoid `try-catch` for control flow

```kotlin
// BAD — using exceptions for control flow
val user = try { repository.getUser(id) } catch (e: NotFoundException) { null }

// GOOD — nullable return
val user: User? = repository.findUser(id)
```
---

## Rule: kotlin/hooks
---

paths:
  - "**/*.kt"
  - "**/*.kts"
  - "**/build.gradle.kts"
---

# Kotlin Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Kotlin-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **ktfmt/ktlint**: Auto-format `.kt` and `.kts` files after edit
- **detekt**: Run static analysis after editing Kotlin files
- **. build**: Verify compilation after changes
---

## Rule: kotlin/patterns
---

paths:
  - "**/*.kt"
  - "**/*.kts"
---

# Kotlin Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Kotlin and Android/KMP-specific content.

## Dependency Injection

Prefer constructor injection. Use Koin (KMP) or Hilt (Android-only):

```kotlin
// Koin — declare modules
val dataModule = module {
    single<ItemRepository> { ItemRepositoryImpl(get(), get()) }
    factory { GetItemsUseCase(get()) }
    viewModelOf(::ItemListViewModel)
}

// Hilt — annotations
@HiltViewModel
class ItemListViewModel @Inject constructor(
    private val getItems: GetItemsUseCase
) : ViewModel()
```

## ViewModel Pattern

Single state object, event sink, one-way data flow:

```kotlin
data class ScreenState(
    val items: List<Item> = emptyList(),
    val isLoading: Boolean = false
)

class ScreenViewModel(private val useCase: GetItemsUseCase) : ViewModel() {
    private val _state = MutableStateFlow(ScreenState())
    val state = _state.asStateFlow()

    fun onEvent(event: ScreenEvent) {
        when (event) {
            is ScreenEvent.Load -> load()
            is ScreenEvent.Delete -> delete(event.id)
        }
    }
}
```

## Repository Pattern

- `suspend` functions return `Result<T>` or custom error type
- `Flow` for reactive streams
- Coordinate local + remote data sources

```kotlin
interface ItemRepository {
    suspend fun getById(id: String): Result<Item>
    suspend fun getAll(): Result<List<Item>>
    fun observeAll(): Flow<List<Item>>
}
```

## UseCase Pattern

Single responsibility, `operator fun invoke`:

```kotlin
class GetItemUseCase(private val repository: ItemRepository) {
    suspend operator fun invoke(id: String): Result<Item> {
        return repository.getById(id)
    }
}

class GetItemsUseCase(private val repository: ItemRepository) {
    suspend operator fun invoke(): Result<List<Item>> {
        return repository.getAll()
    }
}
```

## expect/actual (KMP)

Use for platform-specific implementations:

```kotlin
// commonMain
expect fun platformName(): String
expect class SecureStorage {
    fun save(key: String, value: String)
    fun get(key: String): String?
}

// androidMain
actual fun platformName(): String = "Android"
actual class SecureStorage {
    actual fun save(key: String, value: String) { /* EncryptedSharedPreferences */ }
    actual fun get(key: String): String? = null /* ... */
}

// iosMain
actual fun platformName(): String = "iOS"
actual class SecureStorage {
    actual fun save(key: String, value: String) { /* Keychain */ }
    actual fun get(key: String): String? = null /* ... */
}
```

## Coroutine Patterns

- Use `viewModelScope` in ViewModels, `coroutineScope` for structured child work
- Use `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initialValue)` for StateFlow from cold Flows
- Use `supervisorScope` when child failures should be independent

## Builder Pattern with DSL

```kotlin
class HttpClientConfig {
    var baseUrl: String = ""
    var timeout: Long = 30_000
    private val interceptors = mutableListOf<Interceptor>()

    fun interceptor(block: () -> Interceptor) {
        interceptors.add(block())
    }
}

fun httpClient(block: HttpClientConfig.() -> Unit): HttpClient {
    val config = HttpClientConfig().apply(block)
    return HttpClient(config)
}

// Usage
val client = httpClient {
    baseUrl = "https://api.example.com"
    timeout = 15_000
    interceptor { AuthInterceptor(tokenProvider) }
}
```

## References

See skill: `kotlin-coroutines-flows` for detailed coroutine patterns.
See skill: `android-clean-architecture` for module and layer patterns.
---

## Rule: kotlin/security
---

paths:
  - "**/*.kt"
  - "**/*.kts"
---

# Kotlin Security

> This file extends [common/security.md](../common/security.md) with Kotlin and Android/KMP-specific content.

## Secrets Management

- Never hardcode API keys, tokens, or credentials in source code
- Use `local.properties` (git-ignored) for local development secrets
- Use `BuildConfig` fields generated from CI secrets for release builds
- Use `EncryptedSharedPreferences` (Android) or Keychain (iOS) for runtime secret storage

```kotlin
// BAD
val apiKey = "sk-abc123..."

// GOOD — from BuildConfig (generated at build time)
val apiKey = BuildConfig.API_KEY

// GOOD — from secure storage at runtime
val token = secureStorage.get("auth_token")
```

## Network Security

- Use HTTPS exclusively — configure `network_security_config.xml` to block cleartext
- Pin certificates for sensitive endpoints using OkHttp `CertificatePinner` or Ktor equivalent
- Set timeouts on all HTTP clients — never leave defaults (which may be infinite)
- Validate and sanitize all server responses before use

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

## Input Validation

- Validate all user input before processing or sending to API
- Use parameterized queries for Room/SQLDelight — never concatenate user input into SQL
- Sanitize file paths from user input to prevent path traversal

```kotlin
// BAD — SQL injection
@Query("SELECT * FROM items WHERE name = '$input'")

// GOOD — parameterized
@Query("SELECT * FROM items WHERE name = :input")
fun findByName(input: String): List<ItemEntity>
```

## Data Protection

- Use `EncryptedSharedPreferences` for sensitive key-value data on Android
- Use `@Serializable` with explicit field names — don't leak internal property names
- Clear sensitive data from memory when no longer needed
- Use `@Keep` or ProGuard rules for serialized classes to prevent name mangling

## Authentication

- Store tokens in secure storage, not in plain SharedPreferences
- Implement token refresh with proper 401/403 handling
- Clear all auth state on logout (tokens, cached user data, cookies)
- Use biometric authentication (`BiometricPrompt`) for sensitive operations

## ProGuard / R8

- Keep rules for all serialized models (`@Serializable`, Gson, Moshi)
- Keep rules for reflection-based libraries (Koin, Retrofit)
- Test release builds — obfuscation can break serialization silently

## WebView Security

- Disable JavaScript unless explicitly needed: `settings.javaScriptEnabled = false`
- Validate URLs before loading in WebView
- Never expose `@JavascriptInterface` methods that access sensitive data
- Use `WebViewClient.shouldOverrideUrlLoading()` to control navigation
---

## Rule: kotlin/testing
---

paths:
  - "**/*.kt"
  - "**/*.kts"
---

# Kotlin Testing

> This file extends [common/testing.md](../common/testing.md) with Kotlin and Android/KMP-specific content.

## Test Framework

- **kotlin.test** for multiplatform (KMP) — `@Test`, `assertEquals`, `assertTrue`
- **JUnit 4/5** for Android-specific tests
- **Turbine** for testing Flows and StateFlow
- **kotlinx-coroutines-test** for coroutine testing (`runTest`, `TestDispatcher`)

## ViewModel Testing with Turbine

```kotlin
@Test
fun `loading state emitted then data`() = runTest {
    val repo = FakeItemRepository()
    repo.addItem(testItem)
    val viewModel = ItemListViewModel(GetItemsUseCase(repo))

    viewModel.state.test {
        assertEquals(ItemListState(), awaitItem())     // initial state
        viewModel.onEvent(ItemListEvent.Load)
        assertTrue(awaitItem().isLoading)               // loading
        assertEquals(listOf(testItem), awaitItem().items) // loaded
    }
}
```

## Fakes Over Mocks

Prefer hand-written fakes over mocking frameworks:

```kotlin
class FakeItemRepository : ItemRepository {
    private val items = mutableListOf<Item>()
    var fetchError: Throwable? = null

    override suspend fun getAll(): Result<List<Item>> {
        fetchError?.let { return Result.failure(it) }
        return Result.success(items.toList())
    }

    override fun observeAll(): Flow<List<Item>> = flowOf(items.toList())

    fun addItem(item: Item) { items.add(item) }
}
```

## Coroutine Testing

```kotlin
@Test
fun `parallel operations complete`() = runTest {
    val repo = FakeRepository()
    val result = loadDashboard(repo)
    advanceUntilIdle()
    assertNotNull(result.items)
    assertNotNull(result.stats)
}
```

Use `runTest` — it auto-advances virtual time and provides `TestScope`.

## Ktor MockEngine

```kotlin
val mockEngine = MockEngine { request ->
    when (request.url.encodedPath) {
        "/api/items" -> respond(
            content = Json.encodeToString(testItems),
            headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        )
        else -> respondError(HttpStatusCode.NotFound)
    }
}

val client = HttpClient(mockEngine) {
    install(ContentNegotiation) { json() }
}
```

## Room/SQLDelight Testing

- Room: Use `Room.inMemoryDatabaseBuilder()` for in-memory testing
- SQLDelight: Use `JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)` for JVM tests

```kotlin
@Test
fun `insert and query items`() = runTest {
    val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
    Database.Schema.create(driver)
    val db = Database(driver)

    db.itemQueries.insert("1", "Sample Item", "description")
    val items = db.itemQueries.getAll().executeAsList()
    assertEquals(1, items.size)
}
```

## Test Naming

Use backtick-quoted descriptive names:

```kotlin
@Test
fun `search with empty query returns all items`() = runTest { }

@Test
fun `delete item emits updated list without deleted item`() = runTest { }
```

## Test Organization

```
src/
├── commonTest/kotlin/     # Shared tests (ViewModel, UseCase, Repository)
├── androidUnitTest/kotlin/ # Android unit tests (JUnit)
├── androidInstrumentedTest/kotlin/  # Instrumented tests (Room, UI)
└── iosTest/kotlin/        # iOS-specific tests
```

Minimum test coverage: ViewModel + UseCase for every feature.
---

## Rule: orchestration-protocol

# Orchestration Protocol

## Delegation Context (MANDATORY)

When spawning subagents via subtask delegation, **ALWAYS** include in prompt:

1. **Work Context Path**: The git root of the PRIMARY files being worked on
2. **Reports Path**: `{work_context}/plans/reports/` for that project
3. **Plans Path**: `{work_context}` for that project

**Example:**
```
Task prompt: "Fix parser bug.
Work context: /path/to/project-b
Reports: /path/to/project-b/plans/reports/
Plans: /path/to/project-b/plans/"
```

**Rule:** If CWD differs from work context (editing files in different project), use the **work context paths**, not CWD paths.
---

#### Sequential Chaining
Chain subagents when tasks have dependencies or require outputs from previous steps:
- **Planning → Implementation → Simplification → Testing → Review**: Use for feature development (tests verify simplified code)
- **Research → Design → Code → Documentation**: Use for new system components
- Each agent completes fully before the next begins
- Pass context and outputs between agents in the chain

#### Parallel Execution
Spawn multiple subagents simultaneously for independent tasks:
- **Code + Tests + Docs**: When implementing separate, non-conflicting components
- **Multiple Feature Branches**: Different agents working on isolated features
- **Cross-platform Development**: iOS and Android specific implementations
- **Careful Coordination**: Ensure no file conflicts or shared resource contention
- **Merge Strategy**: Plan integration points before parallel execution begins
---

## Subagent Status Protocol

Subagents MUST report one of these statuses when completing work:

| Status | Meaning | Controller Action |
|--------|---------|-------------------|
| **DONE** | Task completed successfully | Proceed to next step (review, next task) |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts | Read concerns → address if correctness/scope issue → proceed if observational |
| **BLOCKED** | Cannot complete task | Assess blocker → provide context / break task / escalate to user |
| **NEEDS_CONTEXT** | Missing information to proceed | Provide missing context → re-dispatch |

### Handling Rules

- **Never** ignore BLOCKED or NEEDS_CONTEXT — something must change before retry
- **Never** force same approach after BLOCKED — try: more context → simpler task → more capable model → escalate
- **DONE_WITH_CONCERNS** about file growth or tech debt → note for future, proceed now
- **DONE_WITH_CONCERNS** about correctness → address before review
- If subagent fails 3+ times on same task → escalate to user, don't retry blindly

### Reporting Format

Subagents should end their response with:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary]
**Concerns/Blockers:** [if applicable]
```
---

## Context Isolation Principle

**Subagents receive only the context they need.** Never pass full session history.

### Rules

1. **Craft prompts explicitly** — Provide task description, relevant file paths, acceptance criteria. Not "here's what we discussed."
2. **No session history** — Subagent gets fresh context. Summarize relevant decisions, don't replay conversation.
3. **Scope file references** — List specific files to read/modify. Not "look at the codebase."
4. **Include plan context** — If working from a plan, provide the specific phase text, not the entire plan.
5. **Preserve controller context** — Coordination work stays in main agent. Don't dump coordination details into subagent prompts.

### Prompt Template

```
Task: [specific task description]
Files to modify: [list]
Files to read for context: [list]
Acceptance criteria: [list]
Constraints: [any relevant constraints]
Plan reference: [phase file path if applicable]

Work context: [project path]
Reports: [reports path]
```

### Anti-Patterns

| Bad | Good |
|-----|------|
| "Continue from where we left off" | "Implement X feature per spec in phase-02.md" |
| "Fix the issues we discussed" | "Fix null check in auth.ts:45, root cause: missing validation" |
| "Look at the codebase and figure out" | "Read src/api/routes.ts and add POST  endpoint" |
| Passing 50+ lines of conversation | 5-line task summary with file paths |
---

## Agent Teams (Optional)

For multi-session parallel collaboration, activate the `` skill.
Not part of the default orchestration workflow. See `$HOME/.agents/skills/team/SKILL.md` for templates, decision criteria, and spawn instructions.
---

## Rule: perl/coding-style
---

paths:
  - "**/*.pl"
  - "**/*.pm"
  - "**/*.t"
  - "**/*.psgi"
  - "**/*.cgi"
---

# Perl Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Perl-specific content.

## Standards

- Always `use v5.36` (enables `strict`, `warnings`, `say`, subroutine signatures)
- Use subroutine signatures — never unpack `@_` manually
- Prefer `say` over `print` with explicit newlines

## Immutability

- Use **Moo** with `is => 'ro'` and `Types::Standard` for all attributes
- Never use blessed hashrefs directly — always use Moo/Moose accessors
- **OO override note**: Moo `has` attributes with `builder` or `default` are acceptable for computed read-only values

## Formatting

Use **perltidy** with these settings:

```
-i=4    # 4-space indent
-l=100  # 100 char line length
-ce     # cuddled else
-bar    # opening brace always right
```

## Linting

Use **perlcritic** at severity 3 with themes: `core`, `pbp`, `security`.

```bash
perlcritic --severity 3 --theme 'core || pbp || security' lib/
```

## Reference

See skill: `perl-patterns` for comprehensive modern Perl idioms and best practices.
---

## Rule: perl/hooks
---

paths:
  - "**/*.pl"
  - "**/*.pm"
  - "**/*.t"
  - "**/*.psgi"
  - "**/*.cgi"
---

# Perl Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Perl-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **perltidy**: Auto-format `.pl` and `.pm` files after edit
- **perlcritic**: Run lint check after editing `.pm` files

## Warnings

- Warn about `print` in non-script `.pm` files — use `say` or a logging module (e.g., `Log::Any`)
---

## Rule: perl/patterns
---

paths:
  - "**/*.pl"
  - "**/*.pm"
  - "**/*.t"
  - "**/*.psgi"
  - "**/*.cgi"
---

# Perl Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Perl-specific content.

## Repository Pattern

Use **DBI** or **DBIx::Class** behind an interface:

```perl
package MyApp::Repo::User;
use Moo;

has dbh => (is => 'ro', required => 1);

sub find_by_id ($self, $id) {
    my $sth = $self->dbh->prepare('SELECT * FROM users WHERE id = ?');
    $sth->execute($id);
    return $sth->fetchrow_hashref;
}
```

## DTOs / Value Objects

Use **Moo** classes with **Types::Standard** (equivalent to Python dataclasses):

```perl
package MyApp::DTO::User;
use Moo;
use Types::Standard qw(Str Int);

has name  => (is => 'ro', isa => Str, required => 1);
has email => (is => 'ro', isa => Str, required => 1);
has age   => (is => 'ro', isa => Int);
```

## Resource Management

- Always use **three-arg open** with `autodie`
- Use **Path::Tiny** for file operations

```perl
use autodie;
use Path::Tiny;

my $content = path('config.json')->slurp_utf8;
```

## Module Interface

Use `Exporter 'import'` with `@EXPORT_OK` — never `@EXPORT`:

```perl
use Exporter 'import';
our @EXPORT_OK = qw(parse_config validate_input);
```

## Dependency Management

Use **cpanfile** + **carton** for reproducible installs:

```bash
carton install
carton exec prove -lr t/
```

## Reference

See skill: `perl-patterns` for comprehensive modern Perl patterns and idioms.
---

## Rule: perl/security
---

paths:
  - "**/*.pl"
  - "**/*.pm"
  - "**/*.t"
  - "**/*.psgi"
  - "**/*.cgi"
---

# Perl Security

> This file extends [common/security.md](../common/security.md) with Perl-specific content.

## Taint Mode

- Use `-T` flag on all CGI/web-facing scripts
- Sanitize `%ENV` (`$ENV{PATH}`, `$ENV{CDPATH}`, etc.) before any external command

## Input Validation

- Use allowlist regex for untainting — never `/(.*)/s`
- Validate all user input with explicit patterns:

```perl
if ($input =~ /\A([a-zA-Z0-9_-]+)\z/) {
    my $clean = $1;
}
```

## File I/O

- **Three-arg open only** — never two-arg open
- Prevent path traversal with `Cwd::realpath`:

```perl
use Cwd 'realpath';
my $safe_path = realpath($user_path);
die "Path traversal" unless $safe_path =~ m{\A/allowed/directory/};
```

## Process Execution

- Use **list-form `system()`** — never single-string form
- Use **IPC::Run3** for capturing output
- Never use backticks with variable interpolation

```perl
system('grep', '-r', $pattern, $directory);  # safe
```

## SQL Injection Prevention

Always use DBI placeholders — never interpolate into SQL:

```perl
my $sth = $dbh->prepare('SELECT * FROM users WHERE email = ?');
$sth->execute($email);
```

## Security Scanning

Run **perlcritic** with the security theme at severity 4+:

```bash
perlcritic --severity 4 --theme security lib/
```

## Reference

See skill: `perl-security` for comprehensive Perl security patterns, taint mode, and safe I/O.
---

## Rule: perl/testing
---

paths:
  - "**/*.pl"
  - "**/*.pm"
  - "**/*.t"
  - "**/*.psgi"
  - "**/*.cgi"
---

# Perl Testing

> This file extends [common/testing.md](../common/testing.md) with Perl-specific content.

## Framework

Use **Test2::V0** for new projects (not Test::More):

```perl
use Test2::V0;

is($result, 42, 'answer is correct');

done_testing;
```

## Runner

```bash
prove -l t/              # adds lib/ to @INC
prove -lr -j8 t/         # recursive, 8 parallel jobs
```

Always use `-l` to ensure `lib/` is on `@INC`.

## Coverage

Use **Devel::Cover** — target 80%+:

```bash
cover -test
```

## Mocking

- **Test::MockModule** — mock methods on existing modules
- **Test::MockObject** — create test doubles from scratch

## Pitfalls

- Always end test files with `done_testing`
- Never forget the `-l` flag with `prove`

## Reference

See skill: `perl-testing` for detailed Perl TDD patterns with Test2::V0, prove, and Devel::Cover.
---

## Rule: php/coding-style
---

paths:
  - "**/*.php"
  - "**/composer.json"
---

# PHP Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with PHP specific content.

## Standards

- Follow **PSR-12** formatting and naming conventions.
- Prefer `declare(strict_types=1);` in application code.
- Use scalar type hints, return types, and typed properties everywhere new code permits.

## Immutability

- Prefer immutable DTOs and value objects for data crossing service boundaries.
- Use `readonly` properties or immutable constructors for request/response payloads where possible.
- Keep arrays for simple maps; promote business-critical structures into explicit classes.

## Formatting

- Use **PHP-CS-Fixer** or **Laravel Pint** for formatting.
- Use **PHPStan** or **Psalm** for static analysis.
- Keep Composer scripts checked in so the same commands run locally and in CI.

## Imports

- Add `use` statements for all referenced classes, interfaces, and traits.
- Avoid relying on the global namespace unless the project explicitly prefers fully qualified names.

## Error Handling

- Throw exceptions for exceptional states; avoid returning `false`/`null` as hidden error channels in new code.
- Convert framework/request input into validated DTOs before it reaches domain logic.

## Reference

See skill: `backend-patterns` for broader service/repository layering guidance.
---

## Rule: php/hooks
---

paths:
  - "**/*.php"
  - "**/composer.json"
  - "**/phpstan.neon"
  - "**/phpstan.neon.dist"
  - "**/psalm.xml"
---

# PHP Hooks

> This file extends [common/hooks.md](../common/hooks.md) with PHP specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **Pint / PHP-CS-Fixer**: Auto-format edited `.php` files.
- **PHPStan / Psalm**: Run static analysis after PHP edits in typed codebases.
- **PHPUnit / Pest**: Run targeted tests for touched files or modules when edits affect behavior.

## Warnings

- Warn on `var_dump`, `dd`, `dump`, or `die()` left in edited files.
- Warn when edited PHP files add raw SQL or disable CSRF/session protections.
---

## Rule: php/patterns
---

paths:
  - "**/*.php"
  - "**/composer.json"
---

# PHP Patterns

> This file extends [common/patterns.md](../common/patterns.md) with PHP specific content.

## Thin Controllers, Explicit Services

- Keep controllers focused on transport: auth, validation, serialization, status codes.
- Move business rules into application/domain services that are easy to test without HTTP bootstrapping.

## DTOs and Value Objects

- Replace shape-heavy associative arrays with DTOs for requests, commands, and external API payloads.
- Use value objects for money, identifiers, date ranges, and other constrained concepts.

## Dependency Injection

- Depend on interfaces or narrow service contracts, not framework globals.
- Pass collaborators through constructors so services are testable without service-locator lookups.

## Boundaries

- Isolate ORM models from domain decisions when the model layer is doing more than persistence.
- Wrap third-party SDKs behind small adapters so the rest of the codebase depends on your contract, not theirs.

## Reference

See skill: `api-design` for endpoint conventions and response-shape guidance.
See skill: `laravel-patterns` for Laravel-specific architecture guidance.
---

## Rule: php/security
---

paths:
  - "**/*.php"
  - "**/composer.lock"
  - "**/composer.json"
---

# PHP Security

> This file extends [common/security.md](../common/security.md) with PHP specific content.

## Input and Output

- Validate request input at the framework boundary (`FormRequest`, Symfony Validator, or explicit DTO validation).
- Escape output in templates by default; treat raw HTML rendering as an exception that must be justified.
- Never trust query params, cookies, headers, or uploaded file metadata without validation.

## Database Safety

- Use prepared statements (`PDO`, Doctrine, Eloquent query builder) for all dynamic queries.
- Avoid string-building SQL in controllers/views.
- Scope ORM mass-assignment carefully and whitelist writable fields.

## Secrets and Dependencies

- Load secrets from environment variables or a secret manager, never from committed config files.
- Run `composer audit` in CI and review new package maintainer trust before adding dependencies.
- Pin major versions deliberately and remove abandoned packages quickly.

## Auth and Session Safety

- Use `password_hash()` / `password_verify()` for password storage.
- Regenerate session identifiers after authentication and privilege changes.
- Enforce CSRF protection on state-changing web requests.

## Reference

See skill: `laravel-security` for Laravel-specific security guidance.
---

## Rule: php/testing
---

paths:
  - "**/*.php"
  - "**/phpunit.xml"
  - "**/phpunit.xml.dist"
  - "**/composer.json"
---

# PHP Testing

> This file extends [common/testing.md](../common/testing.md) with PHP specific content.

## Framework

Use **PHPUnit** as the default test framework. If **Pest** is configured in the project, prefer Pest for new tests and avoid mixing frameworks.

## Coverage

```bash
vendor/bin/phpunit --coverage-text
# or
vendor/bin/pest --coverage
```

Prefer **pcov** or **Xdebug** in CI, and keep coverage thresholds in CI rather than as tribal knowledge.

## Test Organization

- Separate fast unit tests from framework/database integration tests.
- Use factory/builders for fixtures instead of large hand-written arrays.
- Keep HTTP/controller tests focused on transport and validation; move business rules into service-level tests.

## Inertia

If the project uses Inertia.js, prefer `assertInertia` with `AssertableInertia` to verify component names and props instead of raw JSON assertions.

## Reference

See skill: `tdd-workflow` for the repo-wide RED -> GREEN -> REFACTOR loop.
See skill: `laravel-tdd` for Laravel-specific testing patterns (PHPUnit and Pest).
---

## Rule: primary-workflow

# Primary Workflow

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT**: Ensure token efficiency while maintaining high quality.

#### 1. Code Implementation
- Before you start, delegate to `planner` agent to create a implementation plan with TODO tasks in `.` directory.
- When in planning phase, use multiple `researcher` agents in parallel to conduct research on different relevant technical topics and report back to `planner` agent to create implementation plan.
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.
- **[IMPORTANT]** After creating or modifying code file, run compile command/script to check for any compile errors.

#### 2. Testing
- Delegate to `tester` agent to run tests on the **simplified code**
  - Write comprehensive unit tests
  - Ensure high code coverage
  - Test error scenarios
  - Validate performance requirements
- Tests verify the FINAL code that will be reviewed and merged
- **DO NOT** ignore failing tests just to pass the build.
- **IMPORTANT:** make sure you don't use fake data, mocks, cheats, tricks, temporary solutions, just to pass the build or github actions.
- **IMPORTANT:** Always fix failing tests follow the recommendations and delegate to `tester` agent to run tests again, only finish your session when all tests pass.

#### 3. Code Quality
- After testing passes, delegate to `code-reviewer` agent to review clean, tested code.
- Follow coding standards and conventions
- Write self-documenting code
- Add meaningful comments for complex logic
- Optimize for performance and maintainability

#### 4. Integration
- Always follow the plan given by `planner` agent
- Ensure seamless integration with existing code
- Follow API contracts precisely
- Maintain backward compatibility
- Document breaking changes
- Delegate to `docs-manager` agent to update docs in `.` directory if any.

#### 5. Debugging
- When a user report bugs or issues on the server or a CI/CD pipeline, delegate to `debugger` agent to run tests and analyze the summary report.
- Read the summary report from `debugger` agent and implement the fix.
- Delegate to `tester` agent to run tests and analyze the summary report.
- If the `tester` agent reports failed tests, fix them follow the recommendations and repeat from the **Step 3**.

#### 6. Visual Explanations
When explaining complex code, protocols, or architecture:
- **When to use:** User asks "explain", "how does X work", "visualize", or topic has 3+ interacting components
- Use ` --explain <topic>` to generate visual explanation with ASCII + Mermaid
- Use ` --diagram <topic>` for architecture and data flow diagrams
- Use ` --slides <topic>` for step-by-step walkthroughs
- Use ` --ascii <topic>` for terminal-friendly output only
- **HTML mode** (add `--html` for self-contained HTML pages, opens directly in browser):
  - ` --html --explain <topic>` — publication-quality HTML explanation
  - ` --html --diagram <topic>` — interactive HTML diagram with zoom controls
  - ` --html --slides <topic>` — magazine-quality slide deck
  - ` --html --diff [ref]` — visual diff review
  - ` --html --plan-review` — plan vs codebase comparison
  - ` --html --recap [timeframe]` — project context snapshot
- **Plan context:** Visuals save to plan folder from `## Plan Context` hook injection; if none, uses `plans/visuals/`
- **Markdown mode:** Auto-opens in browser via markdown-novel-viewer with Mermaid rendering
- **HTML mode:** Opens directly in browser — self-contained, no server needed
- See `development-rules.md` → "Visual Aids" section for additional guidance
---

## Rule: python/coding-style
---

paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Python specific content.

## Standards

- Follow **PEP 8** conventions
- Use **type annotations** on all function signatures

## Immutability

Prefer immutable data structures:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    name: str
    email: str

from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
```

## Formatting

- **black** for code formatting
- **isort** for import sorting
- **ruff** for linting

## Reference

See skill: `python-patterns` for comprehensive Python idioms and patterns.
---

## Rule: python/hooks
---

paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Python specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **black/ruff**: Auto-format `.py` files after edit
- **mypy/pyright**: Run type checking after editing `.py` files

## Warnings

- Warn about `print()` statements in edited files (use `logging` module instead)
---

## Rule: python/patterns
---

paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Python specific content.

## Protocol (Duck Typing)

```python
from typing import Protocol

class Repository(Protocol):
    def find_by_id(self, id: str) -> dict | None: ...
    def save(self, entity: dict) -> dict: ...
```

## Dataclasses as DTOs

```python
from dataclasses import dataclass

@dataclass
class CreateUserRequest:
    name: str
    email: str
    age: int | None = None
```

## Context Managers & Generators

- Use context managers (`with` statement) for resource management
- Use generators for lazy evaluation and memory-efficient iteration

## Reference

See skill: `python-patterns` for comprehensive patterns including decorators, concurrency, and package organization.
---

## Rule: python/security
---

paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python Security

> This file extends [common/security.md](../common/security.md) with Python specific content.

## Secret Management

```python
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ["OPENAI_API_KEY"]  # Raises KeyError if missing
```

## Security Scanning

- Use **bandit** for static security analysis:
  ```bash
  bandit -r src/
  ```

## Reference

See skill: `django-security` for Django-specific security guidelines (if applicable).
---

## Rule: python/testing
---

paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python Testing

> This file extends [common/testing.md](../common/testing.md) with Python specific content.

## Framework

Use **pytest** as the testing framework.

## Coverage

```bash
pytest --cov=src --cov-report=term-missing
```

## Test Organization

Use `pytest.mark` for test categorization:

```python
import pytest

@pytest.mark.unit
def test_calculate_total():
    ...

@pytest.mark.integration
def test_database_connection():
    ...
```

## Reference

See skill: `python-testing` for detailed pytest patterns and fixtures.
---

## Rule: rust/coding-style
---

paths:
  - "**/*.rs"
---

# Rust Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Rust-specific content.

## Formatting

- **rustfmt** for enforcement — always run `cargo fmt` before committing
- **clippy** for lints — `cargo clippy -- -D warnings` (treat warnings as errors)
- 4-space indent (rustfmt default)
- Max line width: 100 characters (rustfmt default)

## Immutability

Rust variables are immutable by default — embrace this:

- Use `let` by default; only use `let mut` when mutation is required
- Prefer returning new values over mutating in place
- Use `Cow<'_, T>` when a function may or may not need to allocate

```rust
use std::borrow::Cow;

// GOOD — immutable by default, new value returned
fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_"))
    } else {
        Cow::Borrowed(input)
    }
}

// BAD — unnecessary mutation
fn normalize_bad(input: &mut String) {
    *input = input.replace(' ', "_");
}
```

## Naming

Follow standard Rust conventions:
- `snake_case` for functions, methods, variables, modules, crates
- `PascalCase` (UpperCamelCase) for types, traits, enums, type parameters
- `SCREAMING_SNAKE_CASE` for constants and statics
- Lifetimes: short lowercase (`'a`, `'de`) — descriptive names for complex cases (`'input`)

## Ownership and Borrowing

- Borrow (`&T`) by default; take ownership only when you need to store or consume
- Never clone to satisfy the borrow checker without understanding the root cause
- Accept `&str` over `String`, `&[T]` over `Vec<T>` in function parameters
- Use `impl Into<String>` for constructors that need to own a `String`

```rust
// GOOD — borrows when ownership isn't needed
fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

// GOOD — takes ownership in constructor via Into
fn new(name: impl Into<String>) -> Self {
    Self { name: name.into() }
}

// BAD — takes String when &str suffices
fn word_count_bad(text: String) -> usize {
    text.split_whitespace().count()
}
```

## Error Handling

- Use `Result<T, E>` and `?` for propagation — never `unwrap()` in production code
- **Libraries**: define typed errors with `thiserror`
- **Applications**: use `anyhow` for flexible error context
- Add context with `.with_context(|| format!("failed to ..."))?`
- Reserve `unwrap()` / `expect()` for tests and truly unreachable states

```rust
// GOOD — library error with thiserror
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to read config: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid config format: {0}")]
    Parse(String),
}

// GOOD — application error with anyhow
use anyhow::Context;

fn load_config(path: &str) -> anyhow::Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read {path}"))?;
    toml::from_str(&content)
        .with_context(|| format!("failed to parse {path}"))
}
```

## Iterators Over Loops

Prefer iterator chains for transformations; use loops for complex control flow:

```rust
// GOOD — declarative and composable
let active_emails: Vec<&str> = users.iter()
    .filter(|u| u.is_active)
    .map(|u| u.email.as_str())
    .collect();

// GOOD — loop for complex logic with early returns
for user in &users {
    if let Some(verified) = verify_email(&user.email)? {
        send_welcome(&verified)?;
    }
}
```

## Module Organization

Organize by domain, not by type:

```text
src/
├── main.rs
├── lib.rs
├── auth/           # Domain module
│   ├── mod.rs
│   ├── token.rs
│   └── middleware.rs
├── orders/         # Domain module
│   ├── mod.rs
│   ├── model.rs
│   └── service.rs
└── db/             # Infrastructure
    ├── mod.rs
    └── pool.rs
```

## Visibility

- Default to private; use `pub(crate)` for internal sharing
- Only mark `pub` what is part of the crate's public API
- Re-export public API from `lib.rs`

## References

See skill: `rust-patterns` for comprehensive Rust idioms and patterns.
---

## Rule: rust/hooks
---

paths:
  - "**/*.rs"
  - "**/Cargo.toml"
---

# Rust Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Rust-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **cargo fmt**: Auto-format `.rs` files after edit
- **cargo clippy**: Run lint checks after editing Rust files
- **cargo check**: Verify compilation after changes (faster than `cargo build`)
---

## Rule: rust/patterns
---

paths:
  - "**/*.rs"
---

# Rust Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Rust-specific content.

## Repository Pattern with Traits

Encapsulate data access behind a trait:

```rust
pub trait OrderRepository: Send + Sync {
    fn find_by_id(&self, id: u64) -> Result<Option<Order>, StorageError>;
    fn find_all(&self) -> Result<Vec<Order>, StorageError>;
    fn save(&self, order: &Order) -> Result<Order, StorageError>;
    fn delete(&self, id: u64) -> Result<(), StorageError>;
}
```

Concrete implementations handle storage details (Postgres, SQLite, in-memory for tests).

## Service Layer

Business logic in service structs; inject dependencies via constructor:

```rust
pub struct OrderService {
    repo: Box<dyn OrderRepository>,
    payment: Box<dyn PaymentGateway>,
}

impl OrderService {
    pub fn new(repo: Box<dyn OrderRepository>, payment: Box<dyn PaymentGateway>) -> Self {
        Self { repo, payment }
    }

    pub fn place_order(&self, request: CreateOrderRequest) -> anyhow::Result<OrderSummary> {
        let order = Order::from(request);
        self.payment.charge(order.total())?;
        let saved = self.repo.save(&order)?;
        Ok(OrderSummary::from(saved))
    }
}
```

## Newtype Pattern for Type Safety

Prevent argument mix-ups with distinct wrapper types:

```rust
struct UserId(u64);
struct OrderId(u64);

fn get_order(user: UserId, order: OrderId) -> anyhow::Result<Order> {
    // Can't accidentally swap user and order IDs at call sites
    todo!()
}
```

## Enum State Machines

Model states as enums — make illegal states unrepresentable:

```rust
enum ConnectionState {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { session_id: String },
    Failed { reason: String, retries: u32 },
}

fn handle(state: &ConnectionState) {
    match state {
        ConnectionState::Disconnected => connect(),
        ConnectionState::Connecting { attempt } if *attempt > 3 => abort(),
        ConnectionState::Connecting { .. } => wait(),
        ConnectionState::Connected { session_id } => use_session(session_id),
        ConnectionState::Failed { retries, .. } if *retries < 5 => retry(),
        ConnectionState::Failed { reason, .. } => log_failure(reason),
    }
}
```

Always match exhaustively — no wildcard `_` for business-critical enums.

## Builder Pattern

Use for structs with many optional parameters:

```rust
pub struct ServerConfig {
    host: String,
    port: u16,
    max_connections: usize,
}

impl ServerConfig {
    pub fn builder(host: impl Into<String>, port: u16) -> ServerConfigBuilder {
        ServerConfigBuilder {
            host: host.into(),
            port,
            max_connections: 100,
        }
    }
}

pub struct ServerConfigBuilder {
    host: String,
    port: u16,
    max_connections: usize,
}

impl ServerConfigBuilder {
    pub fn max_connections(mut self, n: usize) -> Self {
        self.max_connections = n;
        self
    }

    pub fn build(self) -> ServerConfig {
        ServerConfig {
            host: self.host,
            port: self.port,
            max_connections: self.max_connections,
        }
    }
}
```

## Sealed Traits for Extensibility Control

Use a private module to seal a trait, preventing external implementations:

```rust
mod private {
    pub trait Sealed {}
}

pub trait Format: private::Sealed {
    fn encode(&self, data: &[u8]) -> Vec<u8>;
}

pub struct Json;
impl private::Sealed for Json {}
impl Format for Json {
    fn encode(&self, data: &[u8]) -> Vec<u8> { todo!() }
}
```

## API Response Envelope

Consistent API responses using a generic enum:

```rust
#[derive(Debug, serde::Serialize)]
#[serde(tag = "status")]
pub enum ApiResponse<T: serde::Serialize> {
    #[serde(rename = "ok")]
    Ok { data: T },
    #[serde(rename = "error")]
    Error { message: String },
}
```

## References

See skill: `rust-patterns` for comprehensive patterns including ownership, traits, generics, concurrency, and async.
---

## Rule: rust/security
---

paths:
  - "**/*.rs"
---

# Rust Security

> This file extends [common/security.md](../common/security.md) with Rust-specific content.

## Secrets Management

- Never hardcode API keys, tokens, or credentials in source code
- Use environment variables: `std::env::var("API_KEY")`
- Fail fast if required secrets are missing at startup
- Keep `.env` files in `.gitignore`

```rust
// BAD
const API_KEY: &str = "sk-abc123...";

// GOOD — environment variable with early validation
fn load_api_key() -> anyhow::Result<String> {
    std::env::var("PAYMENT_API_KEY")
        .context("PAYMENT_API_KEY must be set")
}
```

## SQL Injection Prevention

- Always use parameterized queries — never format user input into SQL strings
- Use query builder or ORM (sqlx, diesel, sea-orm) with bind parameters

```rust
// BAD — SQL injection via format string
let query = format!("SELECT * FROM users WHERE name = '{name}'");
sqlx::query(&query).fetch_one(&pool).await?;

// GOOD — parameterized query with sqlx
// Placeholder syntax varies by backend: Postgres: $1  |  MySQL: ?  |  SQLite: $1
sqlx::query("SELECT * FROM users WHERE name = $1")
    .bind(&name)
    .fetch_one(&pool)
    .await?;
```

## Input Validation

- Validate all user input at system boundaries before processing
- Use the type system to enforce invariants (newtype pattern)
- Parse, don't validate — convert unstructured data to typed structs at the boundary
- Reject invalid input with clear error messages

```rust
// Parse, don't validate — invalid states are unrepresentable
pub struct Email(String);

impl Email {
    pub fn parse(input: &str) -> Result<Self, ValidationError> {
        let trimmed = input.trim();
        let at_pos = trimmed.find('@')
            .filter(|&p| p > 0 && p < trimmed.len() - 1)
            .ok_or_else(|| ValidationError::InvalidEmail(input.to_string()))?;
        let domain = &trimmed[at_pos + 1..];
        if trimmed.len() > 254 || !domain.contains('.') {
            return Err(ValidationError::InvalidEmail(input.to_string()));
        }
        // For production use, prefer a validated email crate (e.g., `email_address`)
        Ok(Self(trimmed.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}
```

## Unsafe Code

- Minimize `unsafe` blocks — prefer safe abstractions
- Every `unsafe` block must have a `// SAFETY:` comment explaining the invariant
- Never use `unsafe` to bypass the borrow checker for convenience
- Audit all `unsafe` code during review — it is a red flag without justification
- Prefer `safe` FFI wrappers around C libraries

```rust
// GOOD — safety comment documents ALL required invariants
let widget: &Widget = {
    // SAFETY: `ptr` is non-null, aligned, points to an initialized Widget,
    // and no mutable references or mutations exist for its lifetime.
    unsafe { &*ptr }
};

// BAD — no safety justification
unsafe { &*ptr }
```

## Dependency Security

- Run `cargo audit` to scan for known CVEs in dependencies
- Run `cargo deny check` for license and advisory compliance
- Use `cargo tree` to audit transitive dependencies
- Keep dependencies updated — set up Dependabot or Renovate
- Minimize dependency count — evaluate before adding new crates

```bash
# Security audit
cargo audit

# Deny advisories, duplicate versions, and restricted licenses
cargo deny check

# Inspect dependency tree
cargo tree
cargo tree -d  # Show duplicates only
```

## Error Messages

- Never expose internal paths, stack traces, or database errors in API responses
- Log detailed errors server-side; return generic messages to clients
- Use `tracing` or `log` for structured server-side logging

```rust
// Map errors to appropriate status codes and generic messages
// (Example uses axum; adapt the response type to your framework)
match order_service.find_by_id(id) {
    Ok(order) => Ok((StatusCode::OK, Json(order))),
    Err(ServiceError::NotFound(_)) => {
        tracing::info!(order_id = id, "order not found");
        Err((StatusCode::NOT_FOUND, "Resource not found"))
    }
    Err(e) => {
        tracing::error!(order_id = id, error = %e, "unexpected error");
        Err((StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"))
    }
}
```

## References

See skill: `rust-patterns` for unsafe code guidelines and ownership patterns.
See skill: `security-review` for general security checklists.
---

## Rule: rust/testing
---

paths:
  - "**/*.rs"
---

# Rust Testing

> This file extends [common/testing.md](../common/testing.md) with Rust-specific content.

## Test Framework

- **`#[test]`** with `#[cfg(test)]` modules for unit tests
- **rstest** for parameterized tests and fixtures
- **proptest** for property-based testing
- **mockall** for trait-based mocking
- **`#[tokio::test]`** for async tests

## Test Organization

```text
my_crate/
├── src/
│   ├── lib.rs           # Unit tests in #[cfg(test)] modules
│   ├── auth/
│   │   └── mod.rs       # #[cfg(test)] mod tests { ... }
│   └── orders/
│       └── service.rs   # #[cfg(test)] mod tests { ... }
├── tests/               # Integration tests (each file = separate binary)
│   ├── api_test.rs
│   ├── db_test.rs
│   └── common/          # Shared test utilities
│       └── mod.rs
└── benches/             # Criterion benchmarks
    └── benchmark.rs
```

Unit tests go inside `#[cfg(test)]` modules in the same file. Integration tests go in `tests/`.

## Unit Test Pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_user_with_valid_email() {
        let user = User::new("Alice", "alice@example.com").unwrap();
        assert_eq!(user.name, "Alice");
    }

    #[test]
    fn rejects_invalid_email() {
        let result = User::new("Bob", "not-an-email");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("invalid email"));
    }
}
```

## Parameterized Tests

```rust
use rstest::rstest;

#[rstest]
#[case("hello", 5)]
#[case("", 0)]
#[case("rust", 4)]
fn test_string_length(#[case] input: &str, #[case] expected: usize) {
    assert_eq!(input.len(), expected);
}
```

## Async Tests

```rust
#[tokio::test]
async fn fetches_data_successfully() {
    let client = TestClient::new().await;
    let result = client.get("/data").await;
    assert!(result.is_ok());
}
```

## Mocking with mockall

Define traits in production code; generate mocks in test modules:

```rust
// Production trait — pub so integration tests can import it
pub trait UserRepository {
    fn find_by_id(&self, id: u64) -> Option<User>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::eq;

    mockall::mock! {
        pub Repo {}
        impl UserRepository for Repo {
            fn find_by_id(&self, id: u64) -> Option<User>;
        }
    }

    #[test]
    fn service_returns_user_when_found() {
        let mut mock = MockRepo::new();
        mock.expect_find_by_id()
            .with(eq(42))
            .times(1)
            .returning(|_| Some(User { id: 42, name: "Alice".into() }));

        let service = UserService::new(Box::new(mock));
        let user = service.get_user(42).unwrap();
        assert_eq!(user.name, "Alice");
    }
}
```

## Test Naming

Use descriptive names that explain the scenario:
- `creates_user_with_valid_email()`
- `rejects_order_when_insufficient_stock()`
- `returns_none_when_not_found()`

## Coverage

- Target 80%+ line coverage
- Use **cargo-llvm-cov** for coverage reporting
- Focus on business logic — exclude generated code and FFI bindings

```bash
cargo llvm-cov                       # Summary
cargo llvm-cov --html                # HTML report
cargo llvm-cov --fail-under-lines 80 # Fail if below threshold
```

## Testing Commands

```bash
cargo test                       # Run all tests
cargo test -- --nocapture        # Show println output
cargo test test_name             # Run tests matching pattern
cargo test --lib                 # Unit tests only
cargo test --test api_test       # Specific integration test (tests/api_test.rs)
cargo test --doc                 # Doc tests only
```

## References

See skill: `rust-testing` for comprehensive testing patterns including property-based testing, fixtures, and benchmarking with Criterion.
---

## Rule: skill-domain-routing

# Skill Domain Routing

When a user's task involves a specific domain, use these decision trees to pick the RIGHT skill based on user intent.

## Frontend / UI

```
User wants to...
├── Replicate a mockup, screenshot, or video    → /ck:frontend-design
├── Build React/TS components with best practices → /ck:frontend-development
├── Style with Tailwind CSS + shadcn/ui          → /ck:ui-styling
├── Choose colors, fonts, layout, design system  → /ck:ui-ux-pro-max
├── Audit existing UI for accessibility/UX       → /ck:web-design-guidelines
├── Apply React performance patterns             → /ck:react-best-practices
├── Build with Stitch (AI design generation)     → /ck:stitch
├── Create 3D / WebGL / Three.js experience      → /ck:threejs
├── Write GLSL shaders / procedural graphics     → /ck:shader
└── Build programmatic video with Remotion       → /ck:remotion
```

## Codebase Understanding

```
User wants to...
├── Quick file search, locate specific code     → /ck:scout
├── Full codebase dump for LLM context          → /ck:repomix
└── Semantic go-to-definition, find-usages      → /ck:gkg
```

## Backend / API

```
User wants to...
├── Build REST/GraphQL API (NestJS, FastAPI, Django) → /ck:backend-development
├── Add authentication (OAuth, JWT, passkeys)        → /ck:better-auth
└── Integrate payments (Stripe, Polar, SePay)        → /ck:payment-integration
```

## Database

```
User wants to...
├── Design schemas, write SQL/NoSQL queries     → /ck:databases
├── Optimize indexes, migrations, replication   → /ck:databases
└── Add auth with database-backed sessions      → /ck:better-auth
```

## Infrastructure / Deployment

```
User wants to...
├── Deploy to Vercel, Netlify, Railway, Fly.io   → /ck:deploy
└── Docker, Kubernetes, CI/CD pipelines, GitOps   → /ck:devops
```

## Security

```
User wants to...
├── STRIDE/OWASP security audit with auto-fix    → /ck:security
└── Scan for secrets, vulnerabilities, OWASP patterns → /ck:security-scan
```

## AI / LLM

```
User wants to...
├── Optimize context, agent architecture, memory → /ck:context-engineering
├── Generate llms.txt, LLM-friendly docs         → /ck:llms
├── Build AI agents with Google ADK              → /ck:google-adk-python
└── Generate/analyze images, audio, video with AI → /ck:ai-multimodal
```

## MCP (Model Context Protocol)

```
User wants to...
├── Build a new MCP server                       → /ck:mcp-builder
├── Discover and manage existing MCP tools       → /ck:mcp-management
└── Execute MCP tools directly                   → /ck:use-mcp
```

## Testing / Browser

```
User wants to...
├── Run test suites, coverage reports, TDD       → /ck:test
├── Web-specific testing (Playwright, k6, a11y)  → /ck:web-testing
├── Puppeteer automation, screenshots, scraping  → /ck:chrome-devtools
└── AI-driven browser sessions, Browserbase cloud → /ck:agent-browser
```

## Media

```
User wants to...
├── Process video/audio (FFmpeg), images (ImageMagick) → /ck:media-processing
└── Generate AI images (Imagen, Nano Banana)           → /ck:ai-artist
```

## Documentation

```
User wants to...
├── Update project docs (codebase-summary, PDR)  → /ck:docs
├── Search library/framework docs (context7)     → /ck:docs-seeker
├── Build docs site with Mintlify                → /ck:mintlify
└── Create diagrams (Mermaid v11 syntax)         → /ck:mermaidjs-v11
```

## Content / Copy

```
User wants to...
├── Write landing page, email, headline copy     → /ck:copywriting
├── Brand identity, logos, banners               → /ckm:design
└── Create Excalidraw diagrams                   → /ck:excalidraw
```

## Frameworks

```
User wants to...
├── Next.js App Router, RSC, Turborepo           → /ck:web-frameworks
├── TanStack Start/Form/AI                       → /ck:tanstack
├── React Native, Flutter, SwiftUI               → /ck:mobile-development
└── Shopify apps, Polaris, Liquid templates       → /ck:shopify
```

## Usage Notes

- Pick ONE skill per distinct user intent
- If a task spans two domains (e.g. "build + deploy"), suggest the primary skill and mention the secondary
- Domain skills combine with core workflow: `` → domain skill → ``
- Skills not listed here are either core workflow skills (see `skill-workflow-routing.md`) or utility skills activated on demand (e.g. ``, ``, ``)
---

## Rule: skill-workflow-routing

# Skill Workflow Routing

When orchestrating multi-step tasks, consider these workflow sequences. Skills are listed in typical execution order.

## Core Development Workflow

```
/ck:plan → /ck:cook → /ck:test → /ck:code-review → /ck:ship → /ck:journal
```

| User Intent | Suggested Start |
|-------------|----------------|
| "implement feature X", "build X", "add X" | `` then `` |
| "execute this plan" | ` <plan-path>` |
| "quick implementation" | ` --fast` |

## Bugfix Workflow

```
/ck:scout → /ck:debug → /ck:fix → /ck:test → /ck:code-review
```

| User Intent | Suggested Start |
|-------------|----------------|
| "X is broken", "error in X", "bug in X" | `` (auto-scouts internally) |
| "CI is failing", "tests broken" | ` --auto` |
| "investigate why X happens" | `` then `` |

## Investigation Workflow

```
/ck:scout → /ck:debug → /ck:brainstorm → /ck:plan
```

| User Intent | Suggested Start |
|-------------|----------------|
| "understand how X works" | `` |
| "why is X happening" | `` |
| "explore options for X" | `` then `` |

## Post-Implementation Checklist

After completing implementation work, consider:
- `` — review changes before merging
- `` — run full shipping pipeline (tests, review, version, PR)
- `` — document decisions and lessons learned

## Setup Skills

Before starting implementation in a shared codebase:
- `` — create isolated worktree for the feature/fix
- `` — discover relevant files and code patterns
---

## Rule: swift/coding-style
---

paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# Swift Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Swift specific content.

## Formatting

- **SwiftFormat** for auto-formatting, **SwiftLint** for style enforcement
- `swift-format` is bundled with Xcode 16+ as an alternative

## Immutability

- Prefer `let` over `var` — define everything as `let` and only change to `var` if the compiler requires it
- Use `struct` with value semantics by default; use `class` only when identity or reference semantics are needed

## Naming

Follow [Apple API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/):

- Clarity at the point of use — omit needless words
- Name methods and properties for their roles, not their types
- Use `static let` for constants over global constants

## Error Handling

Use typed throws (Swift 6+) and pattern matching:

```swift
func load(id: String) throws(LoadError) -> Item {
    guard let data = try? read(from: path) else {
        throw .fileNotFound(id)
    }
    return try decode(data)
}
```

## Concurrency

Enable Swift 6 strict concurrency checking. Prefer:

- `Sendable` value types for data crossing isolation boundaries
- Actors for shared mutable state
- Structured concurrency (`async let`, `TaskGroup`) over unstructured `Task {}`
---

## Rule: swift/hooks
---

paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# Swift Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Swift specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **SwiftFormat**: Auto-format `.swift` files after edit
- **SwiftLint**: Run lint checks after editing `.swift` files
- **swift build**: Type-check modified packages after edit

## Warning

Flag `print()` statements — use `os.Logger` or structured logging instead for production code.
---

## Rule: swift/patterns
---

paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# Swift Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Swift specific content.

## Protocol-Oriented Design

Define small, focused protocols. Use protocol extensions for shared defaults:

```swift
protocol Repository: Sendable {
    associatedtype Item: Identifiable & Sendable
    func find(by id: Item.ID) async throws -> Item?
    func save(_ item: Item) async throws
}
```

## Value Types

- Use structs for data transfer objects and models
- Use enums with associated values to model distinct states:

```swift
enum LoadState<T: Sendable>: Sendable {
    case idle
    case loading
    case loaded(T)
    case failed(Error)
}
```

## Actor Pattern

Use actors for shared mutable state instead of locks or dispatch queues:

```swift
actor Cache<Key: Hashable & Sendable, Value: Sendable> {
    private var storage: [Key: Value] = [:]

    func get(_ key: Key) -> Value? { storage[key] }
    func set(_ key: Key, value: Value) { storage[key] = value }
}
```

## Dependency Injection

Inject protocols with default parameters — production uses defaults, tests inject mocks:

```swift
struct UserService {
    private let repository: any UserRepository

    init(repository: any UserRepository = DefaultUserRepository()) {
        self.repository = repository
    }
}
```

## References

See skill: `swift-actor-persistence` for actor-based persistence patterns.
See skill: `swift-protocol-di-testing` for protocol-based DI and testing.
---

## Rule: swift/security
---

paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# Swift Security

> This file extends [common/security.md](../common/security.md) with Swift specific content.

## Secret Management

- Use **Keychain Services** for sensitive data (tokens, passwords, keys) — never `UserDefaults`
- Use environment variables or `.xcconfig` files for build-time secrets
- Never hardcode secrets in source — decompilation tools extract them trivially

```swift
let apiKey = ProcessInfo.processInfo.environment["API_KEY"]
guard let apiKey, !apiKey.isEmpty else {
    fatalError("API_KEY not configured")
}
```

## Transport Security

- App Transport Security (ATS) is enforced by default — do not disable it
- Use certificate pinning for critical endpoints
- Validate all server certificates

## Input Validation

- Sanitize all user input before display to prevent injection
- Use `URL(string:)` with validation rather than force-unwrapping
- Validate data from external sources (APIs, deep links, pasteboard) before processing
---

## Rule: swift/testing
---

paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# Swift Testing

> This file extends [common/testing.md](../common/testing.md) with Swift specific content.

## Framework

Use **Swift Testing** (`import Testing`) for new tests. Use `@Test` and `#expect`:

```swift
@Test("User creation validates email")
func userCreationValidatesEmail() throws {
    #expect(throws: ValidationError.invalidEmail) {
        try User(email: "not-an-email")
    }
}
```

## Test Isolation

Each test gets a fresh instance — set up in `init`, tear down in `deinit`. No shared mutable state between tests.

## Parameterized Tests

```swift
@Test("Validates formats", arguments: ["json", "xml", "csv"])
func validatesFormat(format: String) throws {
    let parser = try Parser(format: format)
    #expect(parser.isValid)
}
```

## Coverage

```bash
swift test --enable-code-coverage
```

## Reference

See skill: `swift-protocol-di-testing` for protocol-based dependency injection and mock patterns with Swift Testing.
---

## Rule: team-coordination-rules

# Team Coordination Rules

> These rules only apply when operating as a teammate within an Agent Team.
> They have no effect on standard sessions or subagent workflows.

Rules for agents operating as teammates within an Agent Team.

## File Ownership (CRITICAL)

- Each teammate MUST own distinct files — no overlapping edits
- Define ownership via glob patterns in task descriptions: `File ownership: src/api/*, src/models/*`
- Lead resolves ownership conflicts by restructuring tasks or handling shared files directly
- Tester owns test files only; reads implementation files but never edits them
- If ownership violation detected: STOP and report to lead immediately

## Git Safety

- Prefer git worktrees for implementation teams — each dev in own worktree eliminates conflicts
- Never force-push from a teammate session
- Commit frequently with descriptive messages
- Pull before push to catch merge conflicts early
- If working in a git worktree, commit/push to the worktree branch — not main or dev

## Communication Protocol

- Include actionable findings in messages, not just "I'm done"
- Never send structured JSON status messages — use plain text

## CK Stack Conventions

### Report Output
- Save reports to `{CK_REPORTS_PATH}` (injected via hook, fallback: `plans/reports/`)
- Naming: `{type}-{date}-{slug}.md` where type = your role (researcher, reviewer, debugger)
- Sacrifice grammar for concision. List unresolved questions at end.

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- No AI references in commit messages
- Keep commits focused on actual code changes

### Docs Sync (Implementation Teams Only)
- After completing implementation tasks, lead MUST evaluate docs impact
- State explicitly: `Docs impact: [none|minor|major]`
- If impact: update `docs/` directory or note in completion message

## Task Claiming

- Claim lowest-ID unblocked task first (earlier tasks set up context for later ones)
- Check `TaskList` after completing each task for newly unblocked work
- Set task to `in_progress` before starting work
- If all tasks blocked, notify lead and offer to help unblock

## Plan Approval Flow

When `plan_mode_required` is set:
1. Research and plan your approach (read-only — no file edits)
2. Send plan via `ExitPlanMode` — this triggers approval request to lead
3. Wait for lead's `plan_approval_response`
4. If rejected: revise based on feedback, resubmit
5. If approved: proceed with implementation

## Conflict Resolution

- If two teammates need the same file: escalate to lead immediately
- If a teammate's plan is rejected twice: lead takes over that task
- If findings conflict between reviewers: lead synthesizes and documents disagreement
- If blocked by another teammate's incomplete work: message them directly first, escalate to lead if unresponsive

## Shutdown Protocol

- Approve shutdown requests unless mid-critical-operation
- Always mark current task as completed before approving shutdown
- If rejecting shutdown, explain why concisely
- Extract `requestId` from shutdown request JSON and pass to `shutdown_response`

## Idle State (Normal Behavior)

- Going idle after sending a message is NORMAL — not an error
- Idle means waiting for input, not disconnected
- Sending a message to an idle teammate wakes them up
- Do not treat idle notifications as completion signals — check task status instead

## Discovery

- Read team config at `~/.claude/teams/{team-name}/config.json` to discover teammates
- Always refer to teammates by NAME (not agent ID)
---

## Rule: typescript/coding-style
---

paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with TypeScript/JavaScript specific content.

## Types and Interfaces

Use types to make public APIs, shared models, and component props explicit, readable, and reusable.

### Public APIs

- Add parameter and return types to exported functions, shared utilities, and public class methods
- Let TypeScript infer obvious local variable types
- Extract repeated inline object shapes into named types or interfaces

```typescript
// WRONG: Exported function without explicit types
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}

// CORRECT: Explicit types on public APIs
interface User {
  firstName: string
  lastName: string
}

export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

### Interfaces vs. Type Aliases

- Use `interface` for object shapes that may be extended or implemented
- Use `type` for unions, intersections, tuples, mapped types, and utility types
- Prefer string literal unions over `enum` unless an `enum` is required for interoperability

```typescript
interface User {
  id: string
  email: string
}

type UserRole = 'admin' | 'member'
type UserWithRole = User & {
  role: UserRole
}
```

### Avoid `any`

- Avoid `any` in application code
- Use `unknown` for external or untrusted input, then narrow it safely
- Use generics when a value's type depends on the caller

```typescript
// WRONG: any removes type safety
function getErrorMessage(error: any) {
  return error.message
}

// CORRECT: unknown forces safe narrowing
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}
```

### React Props

- Define component props with a named `interface` or `type`
- Type callback props explicitly
- Do not use `React.FC` unless there is a specific reason to do so

```typescript
interface User {
  id: string
  email: string
}

interface UserCardProps {
  user: User
  onSelect: (id: string) => void
}

function UserCard({ user, onSelect }: UserCardProps) {
  return <button onClick={() => onSelect(user.id)}>{user.email}</button>
}
```

### JavaScript Files

- In `.js` and `.jsx` files, use JSDoc when types improve clarity and a TypeScript migration is not practical
- Keep JSDoc aligned with runtime behavior

```javascript
/**
 * @param {{ firstName: string, lastName: string }} user
 * @returns {string}
 */
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}
```

## Immutability

Use spread operator for immutable updates:

```typescript
interface User {
  id: string
  name: string
}

// WRONG: Mutation
function updateUser(user: User, name: string): User {
  user.name = name // MUTATION!
  return user
}

// CORRECT: Immutability
function updateUser(user: Readonly<User>, name: string): User {
  return {
    ...user,
    name
  }
}
```

## Error Handling

Use async/await with try-catch and narrow unknown errors safely:

```typescript
interface User {
  id: string
  email: string
}

declare function riskyOperation(userId: string): Promise<User>

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

const logger = {
  error: (message: string, error: unknown) => {
    // Replace with your production logger (for example, pino or winston).
  }
}

async function loadUser(userId: string): Promise<User> {
  try {
    const result = await riskyOperation(userId)
    return result
  } catch (error: unknown) {
    logger.error('Operation failed', error)
    throw new Error(getErrorMessage(error))
  }
}
```

## Input Validation

Use Zod for schema-based validation and infer types from the schema:

```typescript
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

type UserInput = z.infer<typeof userSchema>

const validated: UserInput = userSchema.parse(input)
```

## Console.log

- No `console.log` statements in production code
- Use proper logging libraries instead
- See hooks for automatic detection
---

## Rule: typescript/hooks
---

paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Hooks

> This file extends [common/hooks.md](../common/hooks.md) with TypeScript/JavaScript specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **Prettier**: Auto-format JS/TS files after edit
- **TypeScript check**: Run `tsc` after editing `.ts`/`.tsx` files
- **console.log warning**: Warn about `console.log` in edited files

## Stop Hooks

- **console.log audit**: Check all modified files for `console.log` before session ends
---

## Rule: typescript/patterns
---

paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Patterns

> This file extends [common/patterns.md](../common/patterns.md) with TypeScript/JavaScript specific content.

## API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}
```

## Custom Hooks Pattern

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

## Repository Pattern

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```
---

## Rule: typescript/security
---

paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Security

> This file extends [common/security.md](../common/security.md) with TypeScript/JavaScript specific content.

## Secret Management

```typescript
// NEVER: Hardcoded secrets
const apiKey = "sk-proj-xxxxx"

// ALWAYS: Environment variables
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

## Agent Support

- Use **security-reviewer** skill for comprehensive security audits
---

## Rule: typescript/testing
---

paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# TypeScript/JavaScript Testing

> This file extends [common/testing.md](../common/testing.md) with TypeScript/JavaScript specific content.

## E2E Testing

Use **Playwright** as the E2E testing framework for critical user flows.

## Agent Support

- **e2e-runner** - Playwright E2E testing specialist
---

## Rule: web/coding-style

> This file extends [common/coding-style.md](../common/coding-style.md) with web-specific frontend content.

# Web Coding Style

## File Organization

Organize by feature or surface area, not by file type:

```text
src/
├── components/
│   ├── hero/
│   │   ├── Hero.tsx
│   │   ├── HeroVisual.tsx
│   │   └── hero.css
│   ├── scrolly-section/
│   │   ├── ScrollySection.tsx
│   │   ├── StickyVisual.tsx
│   │   └── scrolly.css
│   └── ui/
│       ├── Button.tsx
│       ├── SurfaceCard.tsx
│       └── AnimatedText.tsx
├── hooks/
│   ├── useReducedMotion.ts
│   └── useScrollProgress.ts
├── lib/
│   ├── animation.ts
│   └── color.ts
└── styles/
    ├── tokens.css
    ├── typography.css
    └── global.css
```

## CSS Custom Properties

Define design tokens as variables. Do not hardcode palette, typography, or spacing repeatedly:

```css
:root {
  --color-surface: oklch(98% 0 0);
  --color-text: oklch(18% 0 0);
  --color-accent: oklch(68% 0.21 250);

  --text-base: clamp(1rem, 0.92rem + 0.4vw, 1.125rem);
  --text-hero: clamp(3rem, 1rem + 7vw, 8rem);

  --space-section: clamp(4rem, 3rem + 5vw, 10rem);

  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

## Animation-Only Properties

Prefer compositor-friendly motion:
- `transform`
- `opacity`
- `clip-path`
- `filter` (sparingly)

Avoid animating layout-bound properties:
- `width`
- `height`
- `top`
- `left`
- `margin`
- `padding`
- `border`
- `font-size`

## Semantic HTML First

```html
<header>
  <nav aria-label="Main navigation">...</nav>
</header>
<main>
  <section aria-labelledby="hero-heading">
    <h1 id="hero-heading">...</h1>
  </section>
</main>
<footer>...</footer>
```

Do not reach for generic wrapper `div` stacks when a semantic element exists.

## Naming

- Components: PascalCase (`ScrollySection`, `SurfaceCard`)
- Hooks: `use` prefix (`useReducedMotion`)
- CSS classes: kebab-case or utility classes
- Animation timelines: camelCase with intent (`heroRevealTl`)
---

## Rule: web/design-quality

> This file extends [common/patterns.md](../common/patterns.md) with web-specific design-quality guidance.

# Web Design Quality Standards

## Anti-Template Policy

Do not ship generic template-looking UI. Frontend output should look intentional, opinionated, and specific to the product.

### Banned Patterns

- Default card grids with uniform spacing and no hierarchy
- Stock hero section with centered headline, gradient blob, and generic CTA
- Unmodified library defaults passed off as finished design
- Flat layouts with no layering, depth, or motion
- Uniform radius, spacing, and shadows across every component
- Safe gray-on-white styling with one decorative accent color
- Dashboard-by-numbers layouts with sidebar + cards + charts and no point of view
- Default font stacks used without a deliberate reason

### Required Qualities

Every meaningful frontend surface should demonstrate at least four of these:

1. Clear hierarchy through scale contrast
2. Intentional rhythm in spacing, not uniform padding everywhere
3. Depth or layering through overlap, shadows, surfaces, or motion
4. Typography with character and a real pairing strategy
5. Color used semantically, not just decoratively
6. Hover, focus, and active states that feel designed
7. Grid-breaking editorial or bento composition where appropriate
8. Texture, grain, or atmosphere when it fits the visual direction
9. Motion that clarifies flow instead of distracting from it
10. Data visualization treated as part of the design system, not an afterthought

## Before Writing Frontend Code

1. Pick a specific style direction. Avoid vague defaults like "clean minimal".
2. Define a palette intentionally.
3. Choose typography deliberately.
4. Gather at least a small set of real references.
5. Use ECC design/frontend skills where relevant.

## Worthwhile Style Directions

- Editorial / magazine
- Neo-brutalism
- Glassmorphism with real depth
- Dark luxury or light luxury with disciplined contrast
- Bento layouts
- Scrollytelling
- 3D integration
- Swiss / International
- Retro-futurism

Do not default to dark mode automatically. Choose the visual direction the product actually wants.

## Component Checklist

- [ ] Does it avoid looking like a default Tailwind or shadcn template?
- [ ] Does it have intentional hover/focus/active states?
- [ ] Does it use hierarchy rather than uniform emphasis?
- [ ] Would this look believable in a real product screenshot?
- [ ] If it supports both themes, do both light and dark feel intentional?
---

## Rule: web/hooks

> This file extends [common/hooks.md](../common/hooks.md) with web-specific hook recommendations.

# Web Hooks

## Recommended PostToolUse Hooks

Prefer project-local tooling. Do not wire hooks to remote one-off package execution.

### Format on Save

Use the project's existing formatter entrypoint after edits:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "pnpm prettier --write \"$FILE_PATH\"",
        "description": "Format edited frontend files"
      }
    ]
  }
}
```

Equivalent local commands via `yarn prettier` or `npm exec prettier --` are fine when they use repo-owned dependencies.

### Lint Check

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "pnpm eslint --fix \"$FILE_PATH\"",
        "description": "Run ESLint on edited frontend files"
      }
    ]
  }
}
```

### Type Check

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "pnpm tsc --noEmit --pretty false",
        "description": "Type-check after frontend edits"
      }
    ]
  }
}
```

### CSS Lint

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "pnpm stylelint --fix \"$FILE_PATH\"",
        "description": "Lint edited stylesheets"
      }
    ]
  }
}
```

## PreToolUse Hooks

### Guard File Size

Block oversized writes from tool input content, not from a file that may not exist yet:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "command": "node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const i=JSON.parse(d);const c=i.tool_input?.content||'';const lines=c.split('\\n').length;if(lines>800){console.error('[Hook] BLOCKED: File exceeds 800 lines ('+lines+' lines)');console.error('[Hook] Split into smaller modules');process.exit(2)}console.log(d)})\"",
        "description": "Block writes that exceed 800 lines"
      }
    ]
  }
}
```

## Stop Hooks

### Final Build Verification

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "pnpm build",
        "description": "Verify the production build at session end"
      }
    ]
  }
}
```

## Ordering

Recommended order:
1. format
2. lint
3. type check
4. build verification
---

## Rule: web/patterns

> This file extends [common/patterns.md](../common/patterns.md) with web-specific patterns.

# Web Patterns

## Component Composition

### Compound Components

Use compound components when related UI shares state and interaction semantics:

```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview">...</Tabs.Content>
  <Tabs.Content value="settings">...</Tabs.Content>
</Tabs>
```

- Parent owns state
- Children consume via context
- Prefer this over prop drilling for complex widgets

### Render Props / Slots

- Use render props or slot patterns when behavior is shared but markup must vary
- Keep keyboard handling, ARIA, and focus logic in the headless layer

### Container / Presentational Split

- Container components own data loading and side effects
- Presentational components receive props and render UI
- Presentational components should stay pure

## State Management

Treat these separately:

| Concern | Tooling |
|---------|---------|
| Server state | TanStack Query, SWR, tRPC |
| Client state | Zustand, Jotai, signals |
| URL state | search params, route segments |
| Form state | React Hook Form or equivalent |

- Do not duplicate server state into client stores
- Derive values instead of storing redundant computed state

## URL As State

Persist shareable state in the URL:
- filters
- sort order
- pagination
- active tab
- search query

## Data Fetching

### Stale-While-Revalidate

- Return cached data immediately
- Revalidate in the background
- Prefer existing libraries instead of rolling this by hand

### Optimistic Updates

- Snapshot current state
- Apply optimistic update
- Roll back on failure
- Emit visible error feedback when rolling back

### Parallel Loading

- Fetch independent data in parallel
- Avoid parent-child request waterfalls
- Prefetch likely next routes or states when justified
---

## Rule: web/performance

> This file extends [common/performance.md](../common/performance.md) with web-specific performance content.

# Web Performance Rules

## Core Web Vitals Targets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| FCP | < 1.5s |
| TBT | < 200ms |

## Bundle Budget

| Page Type | JS Budget (gzipped) | CSS Budget |
|-----------|---------------------|------------|
| Landing page | < 150kb | < 30kb |
| App page | < 300kb | < 50kb |
| Microsite | < 80kb | < 15kb |

## Loading Strategy

1. Inline critical above-the-fold CSS where justified
2. Preload the hero image and primary font only
3. Defer non-critical CSS or JS
4. Dynamically import heavy libraries

```js
const gsapModule = await import('gsap');
const { ScrollTrigger } = await import('gsap/ScrollTrigger');
```

## Image Optimization

- Explicit `width` and `height`
- `loading="eager"` plus `fetchpriority="high"` for hero media only
- `loading="lazy"` for below-the-fold assets
- Prefer AVIF or WebP with fallbacks
- Never ship source images far beyond rendered size

## Font Loading

- Max two font families unless there is a clear exception
- `font-display: swap`
- Subset where possible
- Preload only the truly critical weight/style

## Animation Performance

- Animate compositor-friendly properties only
- Use `will-change` narrowly and remove it when done
- Prefer CSS for simple transitions
- Use `requestAnimationFrame` or established animation libraries for JS motion
- Avoid scroll handler churn; use IntersectionObserver or well-behaved libraries

## Performance Checklist

- [ ] All images have explicit dimensions
- [ ] No accidental render-blocking resources
- [ ] No layout shifts from dynamic content
- [ ] Motion stays on compositor-friendly properties
- [ ] Third-party scripts load async/defer and only when needed
---

## Rule: web/security

> This file extends [common/security.md](../common/security.md) with web-specific security content.

# Web Security Rules

## Content Security Policy

Always configure a production CSP.

### Nonce-Based CSP

Use a per-request nonce for scripts instead of `'unsafe-inline'`.

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.example.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
```

Adjust origins to the project. Do not cargo-cult this block unchanged.

## XSS Prevention

- Never inject unsanitized HTML
- Avoid `innerHTML` / `dangerouslySetInnerHTML` unless sanitized first
- Escape dynamic template values
- Sanitize user HTML with a vetted local sanitizer when absolutely necessary

## Third-Party Scripts

- Load asynchronously
- Use SRI when serving from a CDN
- Audit quarterly
- Prefer self-hosting for critical dependencies when practical

## HTTPS and Headers

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Forms

- CSRF protection on state-changing forms
- Rate limiting on submission endpoints
- Validate client and server side
- Prefer honeypots or light anti-abuse controls over heavy-handed CAPTCHA defaults
---

## Rule: web/testing

> This file extends [common/testing.md](../common/testing.md) with web-specific testing content.

# Web Testing Rules

## Priority Order

### 1. Visual Regression

- Screenshot key breakpoints: 320, 768, 1024, 1440
- Test hero sections, scrollytelling sections, and meaningful states
- Use Playwright screenshots for visual-heavy work
- If both themes exist, test both

### 2. Accessibility

- Run automated accessibility checks
- Test keyboard navigation
- Verify reduced-motion behavior
- Verify color contrast

### 3. Performance

- Run Lighthouse or equivalent against meaningful pages
- Keep CWV targets from [performance.md](performance.md)

### 4. Cross-Browser

- Minimum: Chrome, Firefox, Safari
- Test scrolling, motion, and fallback behavior

### 5. Responsive

- Test 320, 375, 768, 1024, 1440, 1920
- Verify no overflow
- Verify touch interactions

## E2E Shape

```ts
import { test, expect } from '@playwright/test';

test('landing hero loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

- Avoid flaky timeout-based assertions
- Prefer deterministic waits

## Unit Tests

- Test utilities, data transforms, and custom hooks
- For highly visual components, visual regression often carries more signal than brittle markup assertions
- Visual regression supplements coverage targets; it does not replace them
---

## Rule: zh/README

# 规则

## 结构

规则按**通用**层和**语言特定**目录组织：

```
rules/
├── common/          # 语言无关的原则（始终安装）
│   ├── coding-style.md
│   ├── git-workflow.md
│   ├── testing.md
│   ├── performance.md
│   ├── patterns.md
│   ├── hooks.md
│   ├── agents.md
│   ├── security.md
│   ├── code-review.md
│   └── development-workflow.md
├── zh/              # 中文翻译版本
│   ├── coding-style.md
│   ├── git-workflow.md
│   ├── testing.md
│   ├── performance.md
│   ├── patterns.md
│   ├── hooks.md
│   ├── agents.md
│   ├── security.md
│   ├── code-review.md
│   └── development-workflow.md
├── typescript/      # TypeScript/JavaScript 特定
├── python/          # Python 特定
├── golang/          # Go 特定
├── swift/           # Swift 特定
└── php/             # PHP 特定
```

- **common/** 包含通用原则 — 无语言特定的代码示例。
- **zh/** 包含 common 目录的中文翻译版本。
- **语言目录** 扩展通用规则，包含框架特定的模式、工具和代码示例。每个文件引用其对应的通用版本。

## 安装

### 选项 1：安装脚本（推荐）

```bash
# 安装通用 + 一个或多个语言特定的规则集
./install.sh typescript
./install.sh python
./install.sh golang
./install.sh swift
./install.sh php

# 同时安装多种语言
./install.sh typescript python
```

### 选项 2：手动安装

> **重要提示：** 复制整个目录 — 不要使用 `/*` 展开。
> 通用和语言特定目录包含同名文件。
> 将它们展开到一个目录会导致语言特定文件覆盖通用规则，
> 并破坏语言特定文件使用的 `..` 相对引用。

```bash
# 创建目标目录
mkdir -p ~/.claude/rules

# 安装通用规则（所有项目必需）
cp -r rules/common ~/.claude/rules/common

# 安装中文翻译版本（可选）
cp -r rules/zh ~/.claude/rules/zh

# 根据项目技术栈安装语言特定规则
cp -r rules/typescript ~/.claude/rules/typescript
cp -r rules/python ~/.claude/rules/python
cp -r rules/golang ~/.claude/rules/golang
cp -r rules/swift ~/.claude/rules/swift
cp -r rules/php ~/.claude/rules/php
```

## 规则 vs 技能

- **规则** 定义广泛适用的标准、约定和检查清单（如"80% 测试覆盖率"、"禁止硬编码密钥"）。
- **技能**（`skills/` 目录）为特定任务提供深入、可操作的参考材料（如 `python-patterns`、`golang-testing`）。

语言特定的规则文件在适当的地方引用相关技能。规则告诉你*做什么*；技能告诉你*怎么做*。

## 规则优先级

当语言特定规则与通用规则冲突时，**语言特定规则优先**（特定覆盖通用）。这遵循标准的分层配置模式（类似于 CSS 特异性或 `.gitignore` 优先级）。

- `rules/common/` 定义适用于所有项目的通用默认值。
- `rules/golang/`、`rules/python/`、`rules/swift/`、`rules/php/`、`rules/typescript/` 等在语言习惯不同时覆盖这些默认值。
- `rules/zh/` 是通用规则的中文翻译，与英文版本内容一致。

### 示例

`common/coding-style.md` 推荐不可变性作为默认原则。语言特定的 `golang/coding-style.md` 可以覆盖这一点：

> 惯用的 Go 使用指针接收器进行结构体变更 — 参见 [common/coding-style.md](../common/coding-style.md) 了解通用原则，但这里首选符合 Go 习惯的变更方式。

### 带覆盖说明的通用规则

`rules/common/` 中可能被语言特定文件覆盖的规则会被标记：

> **语言说明**：此规则可能会被语言特定规则覆盖；对于某些语言，该模式可能并不符合惯用写法。
---

## Rule: zh/agents

# 代理编排

## 可用代理

位于 `~/.codex/agents`：

| 代理 | 用途 | 何时使用 |
|-------|---------|------------|
| planner | 实现规划 | 复杂功能、重构 |
| architect | 系统设计 | 架构决策 |
| tdd-guide | 测试驱动开发 | 新功能、bug 修复 |
| code-reviewer | 代码审查 | 编写代码后 |
| security-reviewer | 安全分析 | 提交前 |
| build-error-resolver | 修复构建错误 | 构建失败时 |
| e2e-runner | E2E 测试 | 关键用户流程 |
| refactor-cleaner | 死代码清理 | 代码维护 |
| doc-updater | 文档 | 更新文档 |
| rust-reviewer | Rust 代码审查 | Rust 项目 |

## 立即使用代理

无需用户提示：
1. 复杂功能请求 - 使用 **planner** 代理
2. 刚编写/修改的代码 - 使用 **code-reviewer** 代理
3. Bug 修复或新功能 - 使用 **tdd-guide** 代理
4. 架构决策 - 使用 **architect** 代理

## 并行任务执行

对独立操作始终使用并行 Task 执行：

```markdown
# 好：并行执行
同时启动 3 个代理：
1. 代理 1：认证模块安全分析
2. 代理 2：缓存系统性能审查
3. 代理 3：工具类型检查

# 坏：不必要的顺序
先代理 1，然后代理 2，然后代理 3
```

## 多视角分析

对于复杂问题，使用分角色子代理：
- 事实审查者
- 高级工程师
- 安全专家
- 一致性审查者
- 冗余检查者
---

## Rule: zh/code-review

# 代码审查标准

## 目的

代码审查确保代码合并前的质量、安全性和可维护性。此规则定义何时以及如何进行代码审查。

## 何时审查

**强制审查触发条件：**

- 编写或修改代码后
- 提交到共享分支之前
- 更改安全敏感代码时（认证、支付、用户数据）
- 进行架构更改时
- 合并 pull request 之前

**审查前要求：**

在请求审查之前，确保：

- 所有自动化检查（CI/CD）已通过
- 合并冲突已解决
- 分支已与目标分支同步

## 审查检查清单

在标记代码完成之前：

- [ ] 代码可读且命名良好
- [ ] 函数聚焦（<50 行）
- [ ] 文件内聚（<800 行）
- [ ] 无深层嵌套（>4 层）
- [ ] 错误显式处理
- [ ] 无硬编码密钥或凭据
- [ ] 无 console.log 或调试语句
- [ ] 新功能有测试
- [ ] 测试覆盖率满足 80% 最低要求

## 安全审查触发条件

**停止并使用 security-reviewer 代理当：**

- 认证或授权代码
- 用户输入处理
- 数据库查询
- 文件系统操作
- 外部 API 调用
- 加密操作
- 支付或金融代码

## 审查严重级别

| 级别 | 含义 | 行动 |
|-------|---------|--------|
| CRITICAL（关键） | 安全漏洞或数据丢失风险 | **阻止** - 合并前必须修复 |
| HIGH（高） | Bug 或重大质量问题 | **警告** - 合并前应修复 |
| MEDIUM（中） | 可维护性问题 | **信息** - 考虑修复 |
| LOW（低） | 风格或次要建议 | **注意** - 可选 |

## 代理使用

使用这些代理进行代码审查：

| 代理 | 用途 |
|-------|--------|
| **code-reviewer** | 通用代码质量、模式、最佳实践 |
| **security-reviewer** | 安全漏洞、OWASP Top 10 |
| **typescript-reviewer** | TypeScript/JavaScript 特定问题 |
| **python-reviewer** | Python 特定问题 |
| **go-reviewer** | Go 特定问题 |
| **rust-reviewer** | Rust 特定问题 |

## 审查工作流

```
1. 运行 git diff 了解更改
2. 先检查安全检查清单
3. 审查代码质量检查清单
4. 运行相关测试
5. 验证覆盖率 >= 80%
6. 使用适当的代理进行详细审查
```

## 常见问题捕获

### 安全

- 硬编码凭据（API 密钥、密码、令牌）
- SQL 注入（查询中的字符串拼接）
- XSS 漏洞（未转义的用户输入）
- 路径遍历（未净化的文件路径）
- CSRF 保护缺失
- 认证绕过

### 代码质量

- 大函数（>50 行）- 拆分为更小的
- 大文件（>800 行）- 提取模块
- 深层嵌套（>4 层）- 使用提前返回
- 缺少错误处理 - 显式处理
- 变更模式 - 优先使用不可变操作
- 缺少测试 - 添加测试覆盖

### 性能

- N+1 查询 - 使用 JOIN 或批处理
- 缺少分页 - 给查询添加 LIMIT
- 无界查询 - 添加约束
- 缺少缓存 - 缓存昂贵操作

## 批准标准

- **批准**：无关键或高优先级问题
- **警告**：仅有高优先级问题（谨慎合并）
- **阻止**：发现关键问题

## 与其他规则的集成

此规则与以下规则配合：

- [testing.md](testing.md) - 测试覆盖率要求
- [security.md](security.md) - 安全检查清单
- [git-workflow.md](git-workflow.md) - 提交标准
- [agents.md](agents.md) - 代理委托
---

## Rule: zh/coding-style

# 编码风格

## 不可变性（关键）

始终创建新对象，永远不要修改现有对象：

```
// 伪代码
错误:  modify(original, field, value) → 就地修改 original
正确: update(original, field, value) → 返回带有更改的新副本
```

原理：不可变数据防止隐藏的副作用，使调试更容易，并启用安全的并发。

## 文件组织

多个小文件 > 少量大文件：
- 高内聚，低耦合
- 典型 200-400 行，最多 800 行
- 从大模块中提取工具函数
- 按功能/领域组织，而非按类型

## 错误处理

始终全面处理错误：
- 在每一层显式处理错误
- 在面向 UI 的代码中提供用户友好的错误消息
- 在服务器端记录详细的错误上下文
- 永远不要静默吞掉错误

## 输入验证

始终在系统边界验证：
- 处理前验证所有用户输入
- 在可用的情况下使用基于模式的验证
- 快速失败并给出清晰的错误消息
- 永远不要信任外部数据（API 响应、用户输入、文件内容）

## 代码质量检查清单

在标记工作完成前：
- [ ] 代码可读且命名良好
- [ ] 函数很小（<50 行）
- [ ] 文件聚焦（<800 行）
- [ ] 没有深层嵌套（>4 层）
- [ ] 正确的错误处理
- [ ] 没有硬编码值（使用常量或配置）
- [ ] 没有变更（使用不可变模式）
---

## Rule: zh/development-workflow

# 开发工作流

> 此文件扩展 [common/git-workflow.md](./git-workflow.md)，包含 git 操作之前的完整功能开发流程。

功能实现工作流描述了开发管道：研究、规划、TDD、代码审查，然后提交到 git。

## 功能实现工作流

0. **研究与重用** _(任何新实现前必需)_
   - **GitHub 代码搜索优先：** 在编写任何新代码之前，运行 `gh search repos` 和 `gh search code` 查找现有实现、模板和模式。
   - **库文档其次：** 使用 Context7 或主要供应商文档确认 API 行为、包使用和版本特定细节。
   - **仅当前两者不足时使用 Exa：** 在 GitHub 搜索和主要文档之后，使用 Exa 进行更广泛的网络研究或发现。
   - **检查包注册表：** 在编写工具代码之前搜索 npm、PyPI、crates.io 和其他注册表。首选久经考验的库而非手工编写的解决方案。
   - **搜索可适配的实现：** 寻找解决问题 80%+ 且可以分支、移植或包装的开源项目。
   - 当满足需求时，优先采用或移植经验证的方法而非从头编写新代码。

1. **先规划**
   - 使用 **planner** 代理创建实现计划
   - 编码前生成规划文档：PRD、架构、系统设计、技术文档、任务列表
   - 识别依赖和风险
   - 分解为阶段

2. **TDD 方法**
   - 使用 **tdd-guide** 代理
   - 先写测试（RED）
   - 实现以通过测试（GREEN）
   - 重构（IMPROVE）
   - 验证 80%+ 覆盖率

3. **代码审查**
   - 编写代码后立即使用 **code-reviewer** 代理
   - 解决关键和高优先级问题
   - 尽可能修复中优先级问题

4. **提交与推送**
   - 详细的提交消息
   - 遵循约定式提交格式
   - 参见 [git-workflow.md](./git-workflow.md) 了解提交消息格式和 PR 流程

5. **审查前检查**
   - 验证所有自动化检查（CI/CD）已通过
   - 解决任何合并冲突
   - 确保分支已与目标分支同步
   - 仅在这些检查通过后请求审查
---

## Rule: zh/git-workflow

# Git 工作流

## 提交消息格式
```
<类型>: <描述>

<可选正文>
```

类型：feat, fix, refactor, docs, test, chore, perf, ci

注意：通过 ~/.claude/settings.json 全局禁用归属。

## Pull Request 工作流

创建 PR 时：
1. 分析完整提交历史（不仅是最新提交）
2. 使用 `git diff [base-branch]...HEAD` 查看所有更改
3. 起草全面的 PR 摘要
4. 包含带有 TODO 的测试计划
5. 如果是新分支，使用 `-u` 标志推送

> 对于 git 操作之前的完整开发流程（规划、TDD、代码审查），
> 参见 [development-workflow.md](./development-workflow.md)。
---

## Rule: zh/hooks

# 钩子系统

## 钩子类型

- **PreToolUse**：工具执行前（验证、参数修改）
- **PostToolUse**：工具执行后（自动格式化、检查）
- **Stop**：会话结束时（最终验证）

## 自动接受权限

谨慎使用：
- 为可信、定义明确的计划启用
- 探索性工作时禁用
- 永远不要使用 dangerously-skip-permissions 标志
- 改为在 `~/.claude.json` 中配置 `allowedTools`

## TodoWrite 最佳实践

使用 TodoWrite 工具：
- 跟踪多步骤任务的进度
- 验证对指令的理解
- 启用实时引导
- 显示细粒度的实现步骤

待办列表揭示：
- 顺序错误的步骤
- 缺失的项目
- 多余的不必要项目
- 错误的粒度
- 误解的需求
---

## Rule: zh/patterns

# 常用模式

## 骨架项目

实现新功能时：
1. 搜索久经考验的骨架项目
2. 使用并行代理评估选项：
   - 安全性评估
   - 可扩展性分析
   - 相关性评分
   - 实现规划
3. 克隆最佳匹配作为基础
4. 在经验证的结构内迭代

## 设计模式

### 仓储模式

将数据访问封装在一致的接口后面：
- 定义标准操作：findAll、findById、create、update、delete
- 具体实现处理存储细节（数据库、API、文件等）
- 业务逻辑依赖抽象接口，而非存储机制
- 便于轻松切换数据源，并简化使用模拟的测试

### API 响应格式

对所有 API 响应使用一致的信封：
- 包含成功/状态指示器
- 包含数据负载（错误时可为空）
- 包含错误消息字段（成功时可为空）
- 包含分页响应的元数据（total、page、limit）
---

## Rule: zh/performance

# 性能优化

## 模型选择策略

**Haiku 4.5**（Sonnet 90% 的能力，3 倍成本节省）：
- 频繁调用的轻量级代理
- 结对编程和代码生成
- 多代理系统中的工作者代理

**Sonnet 4.6**（最佳编码模型）：
- 主要开发工作
- 编排多代理工作流
- 复杂编码任务

**Opus 4.5**（最深度推理）：
- 复杂架构决策
- 最大推理需求
- 研究和分析任务

## 上下文窗口管理

避免在上下文窗口的最后 20% 进行以下操作：
- 大规模重构
- 跨多个文件的功能实现
- 调试复杂交互

上下文敏感度较低的任务：
- 单文件编辑
- 独立工具创建
- 文档更新
- 简单 bug 修复

## 扩展思考 + 规划模式

扩展思考默认启用，为内部推理保留最多 31,999 个 token。

通过以下方式控制扩展思考：
- **切换**：Option+T（macOS）/ Alt+T（Windows/Linux）
- **配置**：在 `~/.claude/settings.json` 中设置 `alwaysThinkingEnabled`
- **预算上限**：`export MAX_THINKING_TOKENS=10000`
- **详细模式**：Ctrl+O 查看思考输出

对于需要深度推理的复杂任务：
1. 确保扩展思考已启用（默认开启）
2. 启用**规划模式**进行结构化方法
3. 使用多轮审查进行彻底分析
4. 使用分角色子代理获得多样化视角

## 构建排查

如果构建失败：
1. 使用 **build-error-resolver** 代理
2. 分析错误消息
3. 增量修复
4. 每次修复后验证
---

## Rule: zh/security

# 安全指南

## 强制安全检查

在任何提交之前：
- [ ] 无硬编码密钥（API 密钥、密码、令牌）
- [ ] 所有用户输入已验证
- [ ] SQL 注入防护（参数化查询）
- [ ] XSS 防护（净化 HTML）
- [ ] CSRF 保护已启用
- [ ] 认证/授权已验证
- [ ] 所有端点启用速率限制
- [ ] 错误消息不泄露敏感数据

## 密钥管理

- 永远不要在源代码中硬编码密钥
- 始终使用环境变量或密钥管理器
- 启动时验证所需的密钥是否存在
- 轮换任何可能已暴露的密钥

## 安全响应协议

如果发现安全问题：
1. 立即停止
2. 使用 **security-reviewer** 代理
3. 在继续之前修复关键问题
4. 轮换任何已暴露的密钥
5. 审查整个代码库中的类似问题
---

## Rule: zh/testing

# 测试要求

## 最低测试覆盖率：80%

测试类型（全部必需）：
1. **单元测试** - 单个函数、工具、组件
2. **集成测试** - API 端点、数据库操作
3. **E2E 测试** - 关键用户流程（框架根据语言选择）

## 测试驱动开发

强制工作流：
1. 先写测试（RED）
2. 运行测试 - 应该失败
3. 编写最小实现（GREEN）
4. 运行测试 - 应该通过
5. 重构（IMPROVE）
6. 验证覆盖率（80%+）

## 测试失败排查

1. 使用 **tdd-guide** 代理
2. 检查测试隔离
3. 验证模拟是否正确
4. 修复实现，而非测试（除非测试有误）

## 代理支持

- **tdd-guide** - 主动用于新功能，强制先写测试
