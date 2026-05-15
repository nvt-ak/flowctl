# Code review — Prioritization, timeboxing & metrics

> **Lazy reference** — load for Tech Lead ordering, PR size guidance, or review summary template. Hub: [../SKILL.md](../SKILL.md).

## 6. Review Prioritization

### 6.1 Priority Order cho Tech Lead
1. **Security issues** (Always first)
2. **Correctness bugs** (Logic errors, data corruption risks)
3. **Performance blockers** (N+1, missing indexes, missing pagination)
4. **Breaking changes** (API changes, removed functionality)
5. **Architecture violations** (Layering, coupling, patterns)
6. **Test coverage** (Missing critical tests)
7. **Code quality** (Readability, naming, complexity)
8. **Documentation** (Missing docs for public APIs)
9. **Style** (Formatting, minor naming)

### 6.2 Time Management
```
Review time estimate:
- < 100 LOC changed: 30-60 minutes
- 100-300 LOC: 1-2 hours
- 300-500 LOC: 2-4 hours (consider splitting PR)
- > 500 LOC: Request to split into smaller PRs
```

## 7. Review Metrics

Ghi vào step summary hoặc PR description:

```markdown
## Code Review Summary
- PR: #{n}
- Review time: {h} hours
- Blockers: {n}
- Issues: {n}
- Suggestions: {n}
- Result: Approved / Changes Requested
```

## 8. Liên Kết

- Review rules: `.cursor/rules/review-rules.mdc`
- GitNexus (CLI) and impact workflows: `.cursor/skills/core/gitnexus-integration/SKILL.md`
- Tech Lead agent review process: `.cursor/agents/tech-lead-agent.md`
- PR templates và checklists: `.cursor/templates/review-checklist-template.md`
