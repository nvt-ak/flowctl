# ADR template & compliance

> Lazy reference — [SKILL.md](../SKILL.md)

## 1. ADR template (copy into `docs/adr/`)

```markdown
# ADR-{NNN}: {Title}
**Date**: YYYY-MM-DD | **Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Deciders**: @tech-lead, @[relevant roles]

## Context
Problem, constraints, and forces (technical, team, timeline). Link prior ADRs or PRD sections.

## Decision
One clear paragraph: what we chose.

## Options considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| A | … | … | Chosen |
| B | … | … | Rejected — reason |
| C | … | … | Rejected — reason |

## Consequences
**Positive**: …  
**Negative / trade-offs**: …  
**Risks to monitor**: …

## Implementation notes
Migration steps, feature flags, or follow-up ADRs. Do **not** put secrets here.

## Compliance & review
- [ ] At least two real options compared (not strawmen)
- [ ] PM acknowledged business impact where applicable
- [ ] Linked from step summary or OpenAPI / design doc
```
