---
name: requirement-analysis
description: "Structured requirement gathering and analysis for PM agents. Use when collecting stakeholder requirements, writing user stories, defining acceptance criteria, MoSCoW prioritization, or producing a PRD. Trigger on any Step 1 task or when the word 'requirement', 'user story', 'PRD', 'acceptance criteria', or 'scope' appears."
triggers: ["requirement", "user-story", "PRD", "acceptance-criteria", "scope", "stakeholder", "MoSCoW"]
when-to-use: "Step 1 (Requirements Analysis), backlog grooming, scope definition, feature specification."
when-not-to-use: "Do not use for technical design, code review, or bug analysis — those have dedicated skills."
prerequisites: []
estimated-tokens: 520
roles-suggested: ["pm"]
version: "1.1.0"
tags: ["requirements", "pm", "planning"]
---

# Requirement analysis (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `requirement-analysis`.

| Topic | Open |
|-------|------|
| Five lenses, user stories, MoSCoW | [references/interview-stories-moscow.md](./references/interview-stories-moscow.md) |
| PRD skeleton, approval gates, Step 2 handoff | [references/prd-gates-handoff.md](./references/prd-gates-handoff.md) |

## Goals

- Turn stakeholder intent into **traceable** scope: stories, AC, and explicit non-goals.
- Protect downstream steps from ambiguous “Must” lists and missing metrics.

## Core workflow

1. Run stakeholder discovery using the **five lenses** (goal, users, constraints, out-of-scope, metrics) — see [interview reference](./references/interview-stories-moscow.md).
2. Write user stories with **Given / When / Then** acceptance criteria.
3. Apply **MoSCoW**; keep Won’t visible to prevent scope creep.
4. Consolidate into a PRD (or equivalent single doc) and align **Must** feasibility with `@tech-lead`.
5. Prepare evidence-backed deliverables per `core-rules.mdc` before approval.

## PM checklist (before approval request)

- [ ] No Must item lacks testable AC.
- [ ] Out-of-scope is explicit and acknowledged where it was debated.
- [ ] Success metrics are concrete or flagged as experiments with a measure-by date.

## When to open lazy depth

- You need the full PRD template, MoSCoW ratios, or Step 2 handoff notes — pick a row in the table above.

## Related skills

- UX discovery overlap: [ux-research/SKILL.md](../ux-research/SKILL.md)  
- Doc shape for ship: [documentation/SKILL.md](../documentation/SKILL.md)
