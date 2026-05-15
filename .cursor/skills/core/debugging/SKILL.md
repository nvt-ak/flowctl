---
name: debugging
description: "Systematic bug diagnosis and root cause analysis for all agents. Use when investigating failures, tracing unexpected behavior, analyzing error logs, or writing bug reports. Trigger on 'bug', 'error', 'fail', 'crash', 'not working', 'unexpected', 'exception', 'debug', or any production incident."
triggers: ["bug", "error", "fail", "crash", "exception", "debug", "incident", "not-working", "broken"]
when-to-use: "Any step when a bug or unexpected behavior is found. Steps 4-8 most common. QA step 7 always."
when-not-to-use: "Do not use for feature development or design — this skill is purely for diagnosis."
prerequisites: []
estimated-tokens: 480
roles-suggested: ["backend", "frontend", "tech-lead", "qa"]
version: "1.1.0"
tags: ["debugging", "quality", "all-roles"]
---

# Debugging (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `debugging`.

| Topic | Open |
|-------|------|
| Evidence, hypotheses | [references/evidence-hypothesis.md](./references/evidence-hypothesis.md) |
| Layers, bug report, escalation | [references/layers-report-escalation.md](./references/layers-report-escalation.md) |

## Scientific loop

1. **Observe** — capture exact symptoms and environment.  
2. **Hypothesize** — list causes; prefer falsifiable statements.  
3. **Test** — smallest experiment per hypothesis.  
4. **Root cause** — fix the cause, not the symptom.  
5. **Verify** — repro gone; add regression coverage where cheap.  
6. **Document** — brief note in report or tracker; escalate if blocked.

## Before you change code

- Confirm reproduction on a **clean** state where possible (fresh build, cleared cache).
- Separate “works on my machine” from environment or data issues.

## Severity sanity

| Level | Typical trigger |
|-------|------------------|
| Critical | Data loss, auth bypass, production down |
| High | Major feature broken, no workaround |
| Medium | Degraded path, workaround exists |
| Low | Cosmetic, rare edge |

## When to open lazy depth

- You need the evidence checklist, layer playbooks, or formal bug report layout — pick a row above.

## Related skills

- Test design: [testing/SKILL.md](../testing/SKILL.md)  
- Security-sensitive defects: [security-review/SKILL.md](../security-review/SKILL.md)
