# Layer patterns, bug report, escalation, after-fix

> Lazy reference — [SKILL.md](../SKILL.md)

## 3. Patterns by layer

### Backend

- Logs first (structured if available); correlate by request id.
- Reproduce under a test or REPL; bisect recent commits.
- DB: verify row counts, locks, migrations applied, connection pool saturation.
- Config: missing env vars often fail at startup; wrong vars fail at runtime.

### Frontend

- Network tab: status, payload shape, CORS, auth headers.
- Console: first error often causes cascade — fix root first.
- Isolate component / route; disable optimistic UI to see server truth.
- State devtools: impossible transitions vs server state.

### Async / integration

- Trace id across services; compare timeouts client vs server vs gateway.
- Queues: depth, DLQ, poison messages; idempotency keys.
- Clock skew and TTL on tokens or caches.

## 4. Bug report template

```markdown
## Bug: [Short title]
**Severity**: Critical | High | Medium | Low  
**Found by**: @[role] | **Date**: YYYY-MM-DD

### Symptom
[Exact message / behavior]

### Reproduce
1. …
2. …
**Expected**: …  
**Actual**: …

### Root cause
[Specific defect — code path, config, or data]

### Fix
[Summary + key files]

### Verification
[Tests run, manual steps, monitoring]

### Follow-ups
[Docs, guardrails, tech debt ticket ids]
```

## 5. Escalation

- **> ~30 minutes** without a falsifiable hypothesis: post `BLOCKER:` with what you tried.
- **Security** suspicion (auth bypass, data leak): CRITICAL path to `@tech-lead` and freeze risky deploys per org policy.

## 6. After fix

- Add regression test or monitor where missing.
- If incident: short timeline note for postmortem without blame.
