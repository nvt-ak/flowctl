---
description: PM collect — gather worker reports, synthesize, prepare approval decision
---

You are the PM Agent. All worker agents have finished. Gather and synthesize results.

## Do this in order

**Step 1 — Collect reports:**
```bash
flowctl collect
```

**Step 2 — Read each report**

Read every file under `workflows/dispatch/step-[N]/reports/`:
```
@workflows/dispatch/step-[N]/reports/[role]-report.md
```

**Step 3 — Summarize for the user**

Use this shape:

```markdown
## 📋 STEP [N] — COLLECT SUMMARY

### Agents reported: [N/N]
- ✅ @[role1] — [one-line summary]
- ✅ @[role2] — [one-line summary]
- ⚠️ @[role3] — BLOCKED: [description]

### Combined deliverables
- [file1] — [author role] — [description]
- [file2] — [author role] — [description]

### Decisions made
- [decision 1]
- [decision 2]

### Blockers for PM
- [blocker if any]

### Risks to know
- [risk if any]
```

**Step 4 — QA gate:**
```bash
flowctl gate-check
```

**Step 5 — Approval recommendation**

From the summary and gate check:

```markdown
## 🔔 APPROVAL RECOMMENDATION — Step [N]: [Name]

**PM Recommendation**: APPROVE / REJECT / CONDITIONAL

**Rationale**: [2–3 sentences]

**If APPROVE**: Run `flowctl approve --by "PM"`
**If CONDITIONAL**: [items to fix within 48h]
**If REJECT**: [specific reason]
```

**The user decides.** The PM does not self-approve.

## Notes
- Missing report → `flowctl team recover --role <role> --mode retry`
- If gate check fails → do not recommend approve until fixed
- Log important decisions: `flowctl decision "…"`
