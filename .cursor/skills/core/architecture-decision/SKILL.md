---
name: architecture-decision
description: "Architecture Decision Record (ADR) writing, system design trade-off analysis, and technology selection. Use when making significant technical decisions, choosing between architectural patterns, evaluating tech stack options, or documenting design rationale. Trigger on 'architecture', 'ADR', 'design decision', 'tech stack', 'trade-off', 'system design'."
triggers: ["architecture", "ADR", "design-decision", "tech-stack", "trade-off", "system-design", "pattern"]
when-to-use: "Step 2 (System Design), any cross-cutting technical decision that will be hard to reverse."
when-not-to-use: "Do not use for day-to-day implementation choices — only significant, hard-to-reverse decisions."
prerequisites: []
estimated-tokens: 550
roles-suggested: ["tech-lead"]
version: "1.1.0"
tags: ["architecture", "tech-lead", "design"]
---

# Architecture decision (compact)

**Lazy depth:** topic files under `references/` — open only what you need; authoritative list in `.cursor/skills/core/manifest.json` → `lazy` for id `architecture-decision`.

| Topic | Open |
|-------|------|
| ADR template | [references/adr-template.md](./references/adr-template.md) |
| Rubric, when ADR, alternatives | [references/rubric-policy.md](./references/rubric-policy.md) |

## Goals

- Make reversibility, trade-offs, and ownership explicit before build-heavy steps.
- Give PM and devs a single place to read **why** a fork was taken.

## Core workflow

1. Frame the problem and **non-negotiables** (latency, compliance, team skills).
2. List **at least two** credible options; eliminate strawmen.
3. Score options (performance, scalability, maintainability, reliability, security, cost) — see [rubric reference](./references/rubric-policy.md).
4. Write the ADR to `docs/adr/`; link it from step 2 artifacts and OpenAPI/design docs as needed.
5. If the decision is superseded later, **deprecate** the ADR and add a successor ADR.

## Tech-lead checklist (before approval request)

- [ ] Decision text is one clear outcome, not a restatement of the problem only.
- [ ] Consequences include **negative** trade-offs, not only benefits.
- [ ] Contracts (API, schema, runbooks) updated or ticketed where this ADR drives change.

## When to open lazy depth

- You need the full ADR skeleton, scoring table guidance, or “ADR vs short note” boundaries — pick a row in the table above.

## Related skills

- API contracts: [api-design/SKILL.md](../api-design/SKILL.md)  
- Security implications of the fork: [security-review/SKILL.md](../security-review/SKILL.md)
