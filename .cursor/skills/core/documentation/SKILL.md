---
name: documentation
description: "Practical documentation standards for technical specs, guides, and handoffs"
triggers: ["docs", "readme", "spec", "handoff"]
when-to-use: "Use for writing or improving technical documentation with clear structure and intent."
when-not-to-use: "Do not use for code changes that need implementation-first workflows."
prerequisites: []
estimated-tokens: 650
roles-suggested: ["pm", "tech-lead", "ui-ux", "backend", "frontend"]
version: "1.1.0"
tags: ["docs", "communication"]
---

# Documentation (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `documentation`.

| Topic | Open |
|-------|------|
| Code docs + OpenAPI | [references/code-openapi.md](./references/code-openapi.md) |
| ADR + changelog | [references/adr-changelog.md](./references/adr-changelog.md) |
| README + tracking + links | [references/readme-tracking.md](./references/readme-tracking.md) |

## Principles

- Document **intent, contracts, and failure modes** — not what the code already says line by line.  
- Co-locate short module readmes where helpful; longer narratives live under `docs/` with stable links.

## APIs

- Maintain machine-readable specs (OpenAPI or equivalent) for public HTTP surfaces; include examples and error shapes.  
- Call out versioning, deprecation, and breaking changes in both spec and human changelog.

## Decisions and releases

- Record non-obvious tradeoffs in ADRs using the team’s naming and storage convention.  
- Ship user-facing release notes for behavior changes; add upgrade steps when breaks are intentional.

## README essentials

- What the project is, how to run it locally, required tool versions, env var **names** (never committed secrets), test and lint entrypoints, and where to file issues.

## When to open lazy depth

- You need full copy-paste templates (OpenAPI blocks, ADR sections, changelog structure) — pick a row above.

## Related skills

- Architecture decisions (ADR-focused): [architecture-decision/SKILL.md](../architecture-decision/SKILL.md)  
- API contract design: [api-design/SKILL.md](../api-design/SKILL.md)
