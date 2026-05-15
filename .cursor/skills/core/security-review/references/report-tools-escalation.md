# Security review — report template, tooling, escalation

> Lazy reference — [SKILL.md](../SKILL.md)

## 4. Security report template

```markdown
## Security review — [scope]
**Reviewer**: … | **Date**: YYYY-MM-DD | **Scope**: paths / endpoints / PR link

### Critical (block merge / deploy)
- …

### High
- …

### Medium
- …

### Low / informational
- …

### Verified positives
- …

### Status: PASS | FAIL | CONDITIONAL
**Conditions**: …
```

## 5. Tooling examples (adapt to stack)

```bash
# Node
npm audit --audit-level=high

# Python
pip-audit
bandit -r src/ -ll

# Secrets in history (careful — coordinate before rewriting history)
git log -S'BEGIN PRIVATE KEY' --oneline
```

Never paste real secrets into tickets or chat.

## 6. When to escalate

- Suspected active exploit or data breach: incident process, not routine PR review.
- Legal / compliance questions: involve designated owner; document assumptions.
