# Requirement analysis — PRD, gates, Step 2 handoff

> Lazy reference — [SKILL.md](../SKILL.md)

## 4. PRD skeleton (minimum)

```markdown
# PRD: [Name]
**Version**: x.y | **Status**: Draft | Review | Approved | **Date**: YYYY-MM-DD

## Executive summary
2–3 sentences: problem, proposed solution, why now.

## Problem statement
Current state, desired state, gap.

## User stories
Grouped by epic or journey.

## Acceptance criteria
Per story (G/W/T or equivalent).

## MoSCoW
Table or list with owner per item where helpful.

## Out of scope
Explicit bullets — signed by PM + Tech Lead when contentious.

## Success metrics
Numbers or binary checks; avoid vague “better / faster”.

## Dependencies and risks
Third parties, data, legal, technical unknowns.

## Open questions
Track to closure before “approval ready.”
```

## 5. Pre-approval quality gate

- [ ] Every **Must** story has testable AC.
- [ ] Stakeholders acknowledged Must set and **Won’t** list.
- [ ] Tech Lead recorded feasibility risks for Must items (no silent “we’ll figure it out”).
- [ ] Metrics are measurable; if not measurable, mark as hypothesis with validation plan.

## 6. Handoff to Step 2

Give Tech Lead: prioritized scope, NFR hints (latency, volume, compliance), and explicit **non-goals** so design does not over-build.
