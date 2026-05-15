---
description: PM orchestrates a flowctl step — auto tier (MICRO/STANDARD/FULL) from complexity score
---

You are the PM Agent. Run the current flowctl step using the smart workflow below.

Topic / context: $ARGUMENTS

---

## PM workflow (automated; user approves at the end)

### PHASE 0 — Complexity assessment & tier routing

```bash
flowctl status
flowctl complexity
flowctl start     # ← pending → in_progress (required before work)
```

Read **Tier** from the output (not only the score):

| Tier | Score | Flow |
|------|-------|------|
| **MICRO** | 1 | → PHASE MICRO (1 agent, minimal ceremony) |
| **STANDARD** | 2–3 | Phase A directly (no War Room with default threshold) |
| **FULL** | 4–5 | War Room (default `WF_WAR_ROOM_THRESHOLD=4`) then dispatch |

---

### PHASE MICRO (only when tier = MICRO)

**Do not create a brief file. Do not run dispatch. You MUST still write a report + collect before approve.**

1. PM picks the single best agent for the step config
2. Spawn **one agent** with a short task — include instructions to write a report:
   ```
   Task(role: "[agent]", description: "[short task]",
        instructions: "Context: [1–2 sentences]. Task: [specific ask]. Output: [expected result].
        When done, create workflows/dispatch/step-N/reports/ if missing,
        then write workflows/dispatch/step-N/reports/[role]-report.md using:
        ## DELIVERABLES\n- DELIVERABLE: path — description
        ## DECISIONS\n- DECISION: text (or NONE)
        ## BLOCKERS\n- BLOCKER: NONE")
   ```
3. When the agent finishes, PM verifies output (read files / results)
4. If the agent **did not** write a report, PM writes `workflows/dispatch/step-N/reports/pm-report.md`:
   ```markdown
   # Worker Report — @pm — Step N: [step name]
   ## SUMMARY
   [2–3 sentences on work done]
   ## DELIVERABLES
   - DELIVERABLE: [path created or verified] — [description]
   ## DECISIONS
   - DECISION: [if any]
   ## BLOCKERS
   - BLOCKER: NONE
   ```
5. **`flowctl collect`** ← required — updates state from report deliverables/decisions
6. **`flowctl gate-check`** ← verify before approve
7. If gate passes → `flowctl approve --by "PM" --note "micro task: [description]"`

**MICRO token budget: ~1,500 tokens total. Do not exceed.**

---

### PHASE 0b — War Room (only when tier = FULL)

```bash
flowctl cursor-dispatch
```

This detects complexity and prints the **War Room Spawn Board** (PM + Tech Lead).

**Spawn 2 agents in parallel:**

1. Tab 1 `@pm`: Read `workflows/dispatch/step-N/war-room/pm-analysis-brief.md` → scope, objectives, acceptance criteria
2. Tab 2 `@tech-lead`: Read `workflows/dispatch/step-N/war-room/tech-lead-assessment-brief.md` → feasibility, risks, mercenary recommendations

**Workflow context** (each agent runs this first):
```
wf_step_context()    ← state + decisions + blockers (~300 tokens, one call)
```
> Graphify (steps 4–8 only): code structure — read `graphify-out/GRAPH_REPORT.md` (and `graphify-out/graph.json` if needed). Not for requirements/decisions/blockers.

When both finish:
```bash
flowctl cursor-dispatch --merge
```
→ Builds `context-digest.md` from both outputs → ready for Phase A

**After War Room, the PM MUST create two files:**

1. `workflows/dispatch/step-N/war-room-plan.md` — from `.cursor/templates/war-room-plan-template.md`
2. `workflows/dispatch/step-N/war-room-checklist.md` — from `.cursor/templates/war-room-checklist-template.md`

A human should read `war-room-plan.md` in ~2 minutes and understand full scope.

---

### PHASE A — Dispatch full team

```bash
flowctl cursor-dispatch --skip-war-room
```

PM uses the **Task tool** to spawn all worker agents **in parallel**:

```
For each role in the current step:
  Task(
    subagent_type: "[role]",
    description: "Execute step N tasks as @[role]",
    instructions: "[full brief file contents]"
  )
```

Each worker must:
1. Load context in layers: `wf_step_context()` → GitNexus (code steps; CLI) → Graphify files (code structure, steps 4–8) → specific files
2. Execute tasks in the brief
3. Write `workflows/dispatch/step-N/reports/[role]-report.md`
4. Declare `DELIVERABLE:` with real paths (EVIDENCE)
5. Declare `NEEDS_SPECIALIST` if blocked

---

### PHASE A COLLECT

When all workers finish:

```bash
flowctl collect
```

Collect will:
- Parse `DECISION:`, `BLOCKER:`, `DELIVERABLE:` from all reports
- Scan `NEEDS_SPECIALIST` sections
- If any → report **PHASE B required**

---

### PHASE B — Mercenary support (if collect says so)

```bash
flowctl mercenary spawn
```

Spawn mercenary specialists in parallel (fewer than Phase A):
- Each mercenary gets a brief under `mercenaries/`
- Output: `mercenaries/[type]-[i]-output.md`

Then re-spawn blocked workers:
```bash
flowctl dispatch --role [blocked-role]
```
(mercenary outputs are injected into briefs automatically)

---

### GATE CHECK + APPROVAL RECOMMENDATION

```bash
flowctl gate-check
flowctl release-dashboard --no-write
```

Present to the user:

```markdown
## 📋 STEP [N] — COLLECT SUMMARY

### Agents reported: [N/N]
- ✅ @[role1] — [summary]
- ✅ @[role2] — [summary]
- ⚠️ @[role3] — BLOCKED: [description]

### Deliverables
- [file] — [role] — [description]

### Key decisions
- [decision 1]

### Phase B mercenaries (if any)
- researcher: [short finding]

### Open blockers
- [if any]

### Gate check
[gate-check result]

---
## 🔔 APPROVAL RECOMMENDATION — Step [N]

**PM recommendation**: APPROVE / REJECT / CONDITIONAL

**Rationale**: [2–3 sentences]

**If APPROVE**: `flowctl approve --by "PM"`
→ Then: `flowctl retro` (capture lessons)

**If CONDITIONAL**: [items to fix within 48h]
**If REJECT**: [reason + next steps]
```

**⏸ STOP — wait for the user. The PM does NOT self-approve.**

---

## Flags

**cursor-dispatch**

- `--skip-war-room` — skip War Room; generate briefs immediately.
- `--merge` — merge War Room outputs → `context-digest.md`.
- `--high-risk` — set `dispatch_risk.high_risk` on the current step (+complexity score).
- `--impacted-modules N` — record module count (PM); `N > 2` adds score.
- `--force-war-room` — always run War Room (or env `WF_FORCE_WAR_ROOM=1`).

War Room threshold: `WF_WAR_ROOM_THRESHOLD` (default **4**).

**Other**

- `--sync`: collect + summary only (after workers finished)
- `--phase-b`: mercenary phase only

---

## Token optimization protocol

Every agent follows four context layers:

**Layer 1 — Workflow MCP (highest priority, ~300 tokens):**
```
wf_step_context()                        ← state + decisions + blockers (one call)
wf_state()                               ← step/status only (if enough)
```

**Layer 2 — GitNexus + code overview (steps 4–8 only):**
```
# GitNexus: CLI only (not MCP) — e.g. gitnexus commit, gitnexus pr (see .cursor/rules/tool-constraints.mdc)
# Code structure: read graphify-out/GRAPH_REPORT.md (and graphify-out/graph.json if needed)
```

**Layer 3 — Graphify (steps 4–8, code structure only):**
```
# Read-only outputs under graphify-out/ — symbols, imports, call graph
# Do not use Graphify for requirements, decisions, or workflow state (use wf_step_context / flowctl state)
```

**Layer 4 — File reads (fallback):**
- `@workflows/dispatch/step-N/context-digest.md` ← War Room output
- Open specific files only when layers 1–3 are insufficient

**Do not read entire prior-step reports.**

---

## Post-approve: retro

After the user approves, the PM runs:
```bash
flowctl retro
```
→ Extract patterns → `workflows/retro/lessons.json`  
→ Lessons inject into the next step’s War Room when configured
