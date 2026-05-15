---
name: ux-research
description: "UX research methods, user interview frameworks, usability testing, and design validation. Use when conducting user research, analyzing user behavior, creating personas, defining user flows, running usability tests, or validating design decisions with data. Trigger on 'UX', 'user research', 'persona', 'user flow', 'usability', 'design validation', 'UI/UX'."
triggers: ["ux", "user-research", "persona", "user-flow", "usability", "design-validation", "wireframe", "prototype"]
when-to-use: "Step 3 (UI/UX Design). Also Step 1 for user discovery, Step 7 for usability testing."
when-not-to-use: "Do not use for backend API design or infrastructure decisions."
prerequisites: []
estimated-tokens: 480
roles-suggested: ["ui-ux"]
version: "1.1.0"
tags: ["ux", "design", "research"]
---

# UX research (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `ux-research`.

| Topic | Open |
|-------|------|
| Methods, personas, flows | [references/methods-personas-flows.md](./references/methods-personas-flows.md) |
| Checklist, usability, synthesis | [references/checklist-usability-synthesis.md](./references/checklist-usability-synthesis.md) |

## Goals

- Ground UI decisions in **observed** user problems, not only stakeholder opinion.
- Produce artifacts PM and Frontend can trace: flows, states, and testable hypotheses.

## Core workflow

1. Align on **questions** the research must answer (not “research for research”).
2. Choose methods (interview, journey, prototype test) sized to the risk — see DETAIL table.
3. Capture personas / flows with **errors and empty states**, not only happy paths.
4. Run lightweight usability tests on clickable artifacts when stakes are high.
5. Synthesize themes into backlog-ready items with severity.

## UI/UX checklist (before design approval)

- [ ] Critical journeys have explicit states: loading, success, error, empty.
- [ ] Accessibility targets agreed with Tech Lead where engineering is uncertain.

## When to open lazy depth

- You need full persona and usability templates or the expanded design review list — pick a row above.

## Related skills

- Requirements overlap: [requirement-analysis/SKILL.md](../requirement-analysis/SKILL.md)  
- Doc handoff: [documentation/SKILL.md](../documentation/SKILL.md)
