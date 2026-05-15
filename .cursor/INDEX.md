# flowctl — Cursor INDEX

Quick map: role → agent file. Read **QUICK REF** at top of each agent file.
Only open `.cursor/rules/` or skills when the task requires it — preserve context budget.

## Language policy (machine prompts)

These paths are **English only** for defaults: `.cursor/rules/*.mdc`, `.cursor/agents/*.md`, `.cursor/skills/**/SKILL.md`. **Lazy depth** lives in paths listed per skill in `manifest.json` (`lazy` array): small **topic references** under `skills/core/<id>/references/` — open only the file that matches the task; never preload the whole set. Human-facing workflow documentation under `docs/` may use Vietnamese where the project already does; link to `.cursor/rules/` instead of duplicating policy.

## Machine-prompt inventory (Wave 0)

| Path | Role |
|------|------|
| `.cursor/rules/core-rules.mdc` | Always-on workflow + quality + approvals |
| `.cursor/rules/tool-constraints.mdc` | Always-on Graphify + GitNexus guardrails |
| `.cursor/rules/review-rules.mdc` | Always-on PR/review invariants |
| `.cursor/agents/*.md` | Per-step persona + constraints; optional YAML `skills-to-load` (`compact` / `lazy_detail`) lists core skill **ids** (folder names under `skills/core/`) |
| `.cursor/skills/core/*/SKILL.md` | On-demand domain playbooks (compact English) |
| `.cursor/skills/core/manifest.json` | P3 registry: `compact` + `lazy[]` paths per skill (for tooling / `audit-tokens --skill-sizes`) |
| `.cursor/skills/core/*/references/*.md` | Lazy topic files — **never preload**; follow hub table in each `SKILL.md` |
| `.cursor/commands/*.md` | Slash / worker command briefs |
| `.cursor/templates/*.md` | Step summaries, approvals, checklists (load at collect/review) |

## Core Agents (9-step flow)

| Step | Primary | File |
|------|---------|------|
| 1 | pm | [agents/pm-agent.md](agents/pm-agent.md) |
| 2 | tech-lead | [agents/tech-lead-agent.md](agents/tech-lead-agent.md) |
| 3 | ui-ux | [agents/ui-ux-agent.md](agents/ui-ux-agent.md) |
| 4 | backend | [agents/backend-dev-agent.md](agents/backend-dev-agent.md) |
| 5 | frontend | [agents/frontend-dev-agent.md](agents/frontend-dev-agent.md) |
| 6 | tech-lead | [agents/tech-lead-agent.md](agents/tech-lead-agent.md) |
| 7 | qa | [agents/qa-agent.md](agents/qa-agent.md) |
| 8 | devops | [agents/devops-agent.md](agents/devops-agent.md) |
| 9 | pm + tech-lead | pm + tech-lead |

| Extra | File |
|-------|------|
| mercenary | [agents/mercenary-agent.md](agents/mercenary-agent.md) |

## Optional roles (on-demand)

PM assigns in state or spawns manually when a lane needs a specialist. These agent files are **English** machine prompts.

| Name | File |
|------|------|
| data | [agents/data-agent.md](agents/data-agent.md) |
| security | [agents/security-agent.md](agents/security-agent.md) |
| reviewer | [agents/reviewer-agent.md](agents/reviewer-agent.md) |
| tech-writer | [agents/tech-writer-agent.md](agents/tech-writer-agent.md) |

Spawn via Task `subagent_type` or your team’s dispatch convention.

## Commands & Docs

- **Repo root**: [CLAUDE.md](../CLAUDE.md) (quick-start), [docs/workflow-reference.md](../docs/workflow-reference.md) (full detail).
- **flowctl**: `flowctl --help` — `cursor-dispatch` supports `--high-risk`, `--impacted-modules N`, `--force-war-room`, `--skip-war-room`, `--merge`.
- **Slash commands**: [.cursor/commands/](commands/) — `kickoff`, `brief`, `report`, `done`, `load-skill`.

## Loading Contract

| File type | When to load |
|-----------|-------------|
| `rules/core-rules.mdc`, `tool-constraints.mdc`, `review-rules.mdc` | Injected by Cursor as always-on rules — keep edits compact |
| Agent file | Once per task (current role only) |
| `SKILL.md` quick ref | On demand — only when skill is needed for the task |
| Manifest `lazy` paths | Only the references(s) needed for the task; never preload all |
| `skills/core/manifest.json` | Agents do not load; humans/tools only — validates split-skill layout |
| `templates/review-checklists-per-step.md` | Only during `flowctl collect` / approval preparation |

**Do NOT preload** all lazy references or templates during normal task execution.

## Optional Token Tools (no hard dependency)

- **[Caveman](https://github.com/juliusbrussee/caveman)** — ultra-compact skill output. Details: `docs/workflow-reference.md` § Caveman.
- **[RTK](https://github.com/rtk-ai/rtk)** — collapse verbose CLI stdout.
- **MCP `user-cavemem`** — observe/search memory if enabled in Cursor; does not replace flowctl state.
