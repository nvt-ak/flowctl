# Evidence & hypothesis discipline

> Lazy reference — [SKILL.md](../SKILL.md)

## 1. Evidence bundle (collect before deep dive)

- Exact error text and stack trace (no paraphrase).
- Minimal reproduction steps (fewest clicks / calls).
- Expected vs actual behavior.
- Last known good: commit hash, release tag, or deploy id.
- Environment: dev / staging / prod, OS, runtime versions, feature flags.
- Recent changes: `git log --oneline -20`, deploy log, or config diff.

## 2. Hypothesis discipline

For each hypothesis:

1. State it in one sentence and what would **falsify** it.
2. Run the smallest experiment (unit test, log line, feature flag, replay).
3. Record outcome; discard or escalate.

Avoid parallel shotgun changes — one variable at a time when possible.
