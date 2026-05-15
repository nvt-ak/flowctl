---
description: Pick the right skill to open (manual in Cursor / Claude)
---

Choose a skill by domain (frontend, security, test, …). In Cursor: Skills panel or describe it in the prompt.

Repo skills live under `skills/` / plugin cache per your machine — no mandatory bash command here.

## Loading contract (`.cursor/skills/core/`)

1. Open **`SKILL.md`** in the skill folder first — hub with **topic links** (token budget).  
2. Open **only the lazy file(s)** you need: see the hub table in `SKILL.md` and/or the `lazy` array in [../skills/core/manifest.json](../skills/core/manifest.json). For `code-review`, prefer `references/*.md` over loading every file. **Do not preload** all lazy paths.  
3. **Authoritative list** of compact + lazy paths: [../skills/core/manifest.json](../skills/core/manifest.json).

Agent files may declare `skills-to-load.compact` / `skills-to-load.lazy_detail` in YAML frontmatter — same **id** strings as `manifest.json` entries (plus non-split skills such as `api-design` / `deployment`: load `SKILL.md` only).

Canonical index: [.cursor/INDEX.md](../INDEX.md). Token audit: `flowctl audit-tokens --skill-sizes`.
