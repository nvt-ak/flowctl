---
name: gitnexus-integration
description: "GitNexus workflows for impact analysis, context lookup, and safe refactoring"
triggers: ["gitnexus", "impact", "context", "refactor"]
when-to-use: "Use when modifying symbols and needing blast-radius or git workflow help before or after code changes."
when-not-to-use: "Do not use for workflow state or requirements; use flowctl / `wf_step_context()` instead."
prerequisites: []
estimated-tokens: 700
roles-suggested: ["tech-lead", "backend", "frontend", "devops", "qa"]
version: "1.1.0"
tags: ["analysis", "refactoring"]
---

# GitNexus integration (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `gitnexus-integration`. Open only when the compact page is not enough.

| Topic | Open |
|-------|------|
| Intro + CLI reference | [references/intro-cli.md](./references/intro-cli.md) |
| Per-step workflow | [references/workflow-by-step.md](./references/workflow-by-step.md) |
| Review, commits, hooks, health | [references/review-hooks-health.md](./references/review-hooks-health.md) |

**Hard rule (this repo):** GitNexus is a **terminal CLI**, not an MCP tool. There is **no** `gitnexus_get_architecture()` API. See `.cursor/rules/tool-constraints.mdc` and root `AGENTS.md`.

## What to use it for

- Smarter **commits** and **PR descriptions** from local diffs and history.  
- **Branch hygiene** consistent with team Gitflow (see `tool-constraints.mdc` for allowed prefixes).  
- Optional **review** helpers that run as CLI in your environment (never invent MCP calls in prompts).

## Before risky edits (Steps 4–8)

- Understand blast radius from project guidance: read `graphify-out/GRAPH_REPORT.md` (and graph MCP if configured) for structure; use GitNexus CLI where your install documents impact or rename flows.  
- If the index is stale, follow project docs to refresh (e.g. `npx gitnexus analyze` when that applies to your setup).

## After coding

- Prefer conventional commits and PR bodies that list verification steps, risk, and rollback.  
- Run `python3 -m graphify update .` after substantive code edits when graph snapshots are part of review.

## When to open lazy depth

- You want long command lists, narrative per-flowctl-step examples, or legacy notes not duplicated here — pick a row above.

## Related skills

- Code graph (read-only): [graphify-integration/SKILL.md](../graphify-integration/SKILL.md)  
- Code review gates: [code-review/SKILL.md](../code-review/SKILL.md)
