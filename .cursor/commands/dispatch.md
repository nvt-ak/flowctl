---
description: PM dispatch — generate briefs and Spawn Board for all agents on the current step
---

You are the PM Agent coordinating the current flowctl step.

## Do this in order

**Step 1 — Read flowctl state:**
```bash
flowctl status
```

**Step 2 — Generate briefs + Spawn Board:**
```bash
flowctl cursor-dispatch
```

**Step 3 — Present the Spawn Board to the user.**

After step 2 output, explain clearly:

1. **MODE A (Cursor Agent tabs)** — Use when you want to watch each agent work:
   - Open Agents: `Cmd+Shift+I` (Mac) or `Ctrl+Shift+I` (Windows)
   - New tab per listed role
   - Paste the generated prompt for each tab
   - Each tab reads its brief and executes

2. **MODE B (Task tool, inline)** — Use when you want automation:
   - Use the Cursor Task tool to spawn subagents from this chat
   - Subagents run in parallel; results return in this thread

**Step 4 — Collect guidance**

When all agents finish, the PM runs:
```bash
flowctl collect
```
or type `/collect` in this PM chat.

## Notes
- Do not approve the step until `/collect` shows all reports are present
- If an agent is stale > 5 minutes: `flowctl team recover --role <role> --mode resume`
- Only the PM may approve/reject a step
