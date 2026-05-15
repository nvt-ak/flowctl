---
name: graphify-integration
description: "Graphify code-structure graph via graphify-out/ (read-only). Steps 4–8 only."
triggers: ["graphify", "code structure", "dependency graph", "call graph"]
when-to-use: "Use when you need module layout, call relationships, or symbol neighborhoods during implementation or review (steps 4–8)."
when-not-to-use: "Do not use for requirements, decisions, blockers, or step status — use `wf_step_context()` / flowctl state instead."
prerequisites: ["graphify-out/graph.json (run `python3 -m graphify update .` if missing or stale)"]
estimated-tokens: 520
roles-suggested: ["tech-lead", "backend", "frontend", "devops", "qa"]
version: "2.1.0"
tags: ["graph", "code-structure"]
---

# Graphify integration (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `graphify-integration`. Load on demand only.

| Topic | Open |
|-------|------|
| Contract, when to use, CLI, workflow | [references/basics-workflow.md](./references/basics-workflow.md) |
| Role patterns, lazy rule, rebuild | [references/patterns-rebuild.md](./references/patterns-rebuild.md) |

**Always-on guardrails:** `.cursor/rules/tool-constraints.mdc` (Graphify scope, forbidden fake tools, rebuild command).

## What Graphify is (and is not)

- **Is:** AST-derived **code** graph — symbols, imports, clusters, call-style relationships in `graphify-out/`.  
- **Is not:** Workflow, PRD, decisions, or blockers — never substitute for `wf_step_context()`.  
- **Is not:** A write API — do not invent `graphify_update_node`, `graphify_snapshot`, or similar.

## Default workflow (no MCP assumed)

1. **Overview:** read `graphify-out/GRAPH_REPORT.md` (use `graphify-out/wiki/index.md` if present).  
2. **Detail:** load `graphify-out/graph.json` for targeted queries (nodes, edges, clusters).  
3. **Rebuild** after substantive code edits in a session: `python3 -m graphify update .` (AST-only, no API cost).

If `graph.json` is missing or empty, rebuild once; if still empty, read source — do not pretend the graph answered.

## Optional MCP

If this repo’s Cursor `mcp.json` enables a **read-only** graph MCP, use only tools documented there. If none is configured, rely on files only.

## When to open lazy depth

- You want the longer Vietnamese walkthrough, extended Python examples, or role-specific read patterns — pick a row above.

## Related

- Git workflow (CLI, not graph): [gitnexus-integration/SKILL.md](../gitnexus-integration/SKILL.md)  
- Review quality gates: [code-review/SKILL.md](../code-review/SKILL.md)
