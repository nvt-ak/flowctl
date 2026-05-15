---
name: code-review
description: "Structured review workflow for correctness, risk, and maintainability"
triggers: ["review", "pull-request", "refactor", "quality"]
when-to-use: "Use for code review requests, defect prevention, and pre-merge quality checks."
when-not-to-use: "Do not use for production incident triage; use debugging or incident-response skills."
prerequisites: []
estimated-tokens: 700
roles-suggested: ["tech-lead", "backend", "frontend", "qa"]
version: "1.2.0"
tags: ["quality", "review"]
---

# Code Review (compact)

**Smart lazy load:** open **one** topic file below — do not preload all references. Paths are relative to this folder. Registry: `.cursor/skills/core/manifest.json` (`lazy` array for `code-review`).

**Repo merge gates:** `.cursor/rules/review-rules.mdc` (review types, SLAs, comment prefixes, tech-lead must-pass list).

## Goals

- Catch defects, security issues, and maintainability problems before merge.
- Keep feedback specific, constructive, and severity-tagged; prefer learning over gatekeeping.

## Severity (PR comments)

| Level | Meaning | Merge |
|-------|---------|-------|
| **blocker** | Correctness, security, data loss | Must fix |
| **major** | Bug risk, missing tests, broken contracts | Should fix |
| **minor** | Clarity, small refactors, consistency | Nice to have |
| **nit** | Typos, style nits | Optional |

## Tech-lead priority

1. Correctness and security boundaries  
2. API and data contracts (including errors)  
3. Observability without secrets or PII in logs  
4. Automated tests for critical paths and regressions  
5. Performance hotspots (N+1, unbounded work, blocking I/O)  
6. Readability and future change cost

## Author habits (before requesting review)

- Self-review the diff; run project linters and tests.  
- Keep PRs small enough to review in one sitting; describe intent, risk, and verification in the PR body.

## Topic references (load on demand)

| If you are… | Open |
|-------------|------|
| Calibrating tone, prefixes, comment shape | [references/philosophy-comments.md](./references/philosophy-comments.md) |
| Reviewing HTTP API / services / DB layer | [references/checklists-backend.md](./references/checklists-backend.md) |
| Reviewing UI or automated tests | [references/checklists-frontend-tests.md](./references/checklists-frontend-tests.md) |
| Looking for example fixes (security, perf, FE) | [references/findings-examples.md](./references/findings-examples.md) |
| Ordering findings, timeboxing, PR summary template | [references/prioritization-metrics.md](./references/prioritization-metrics.md) |

## Related skills

- Git impact and safe refactors: [gitnexus-integration/SKILL.md](../gitnexus-integration/SKILL.md)  
- Test design and suites: [testing/SKILL.md](../testing/SKILL.md)
