# Requirement analysis — interviews, stories, MoSCoW

> Lazy reference — [SKILL.md](../SKILL.md)

## 1. Stakeholder interview — five lenses

Capture notes under each heading; missing **Out of scope** early is the most common source of late churn.

| Lens | Questions |
|------|-----------|
| **Goal** | Business outcome? What does success look like in one sentence? |
| **Users** | Personas or segments? Current pain? Frequency of use? |
| **Constraints** | Budget, deadline, compliance, platform, integrations? |
| **Out of scope** | What is explicitly **not** in this release? |
| **Success metrics** | Measurable KPIs (baseline + target where possible) |

## 2. User story + acceptance criteria

```
As a [user type],
I want [capability],
So that [outcome / value].

Acceptance criteria (Given / When / Then):
- GIVEN … WHEN … THEN …
- GIVEN … WHEN … THEN …
```

Rules:

- Each **Must** story needs at least **two** G/W/T criteria or equivalent testable statements.
- Prefer customer language in “I want”; technical tasks can be sub-bullets.

## 3. MoSCoW allocation (guideline)

| Priority | Meaning | Rough budget |
|----------|---------|----------------|
| **Must** | Cannot ship without | ~60% |
| **Should** | Important; workaround exists | ~20% |
| **Could** | Nice; first to cut | ~15% |
| **Won’t** | Agreed out of scope for this version | ~5% |

Re-balance with PM if Must creeps above ~70% without extra time.
