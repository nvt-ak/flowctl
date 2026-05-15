# Design checklist, usability script, synthesis

> Lazy reference — [SKILL.md](../SKILL.md)

## 4. Design review checklist (before handoff)

- [ ] Each priority user story maps to a screen or flow state.
- [ ] Mobile and desktop (or agreed breakpoints) covered.
- [ ] Error, empty, loading states designed — not only happy path.
- [ ] WCAG 2.1 AA targets: contrast, focus order, labels (coordinate with `core-rules.mdc`).
- [ ] Tokens: color, type, spacing referenced for dev handoff.
- [ ] Motion: respect `prefers-reduced-motion` where motion is used.

## 5. Usability test script (short form)

**Intro (neutralize performance anxiety):**  
“You are helping us test the product, not your abilities. Think aloud as you go.”

**Tasks (3–5):**  
Scenario-based (“You need to …”). Avoid leading wording.

**Observe:** first clicks, hesitation, errors, verbatim quotes.

**Metrics:** task success (yes/no), time on task (if comparable), error count, optional SUS or 1–5 ease.

**Close:** what felt hardest? one improvement they’d expect.

## 6. Synthesis

Cluster findings into themes; map to MoSCoW or backlog items with severity. Share a **one-page** summary for PM + Tech Lead before wide rework.
