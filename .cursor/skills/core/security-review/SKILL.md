---
name: security-review
description: "Security vulnerability assessment, OWASP Top 10 checking, authentication/authorization review, and security hardening. Use when reviewing code for security issues, assessing authentication flows, checking for injection vulnerabilities, auditing dependencies, or producing a security report. Trigger on 'security', 'vulnerability', 'auth', 'OWASP', 'injection', 'XSS', 'CSRF', 'pentest', 'audit'."
triggers: ["security", "vulnerability", "auth", "OWASP", "injection", "XSS", "CSRF", "pentest", "audit", "CVE"]
when-to-use: "Step 4-5 (during dev), Step 7 (QA security pass), Step 9 (pre-release). Any time auth or data handling code changes."
when-not-to-use: "Do not use for performance optimization or UX design."
prerequisites: []
estimated-tokens: 520
roles-suggested: ["tech-lead", "backend"]
version: "1.1.0"
tags: ["security", "tech-lead", "backend"]
---

# Security review (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `security-review`.

| Topic | Open |
|-------|------|
| OWASP Top 10 deep prompts | [references/owasp-prompts.md](./references/owasp-prompts.md) |
| Auth notes, input/output boundaries | [references/auth-input-output.md](./references/auth-input-output.md) |
| Report template, audit commands, escalation | [references/report-tools-escalation.md](./references/report-tools-escalation.md) |

## Goals

- Catch high-impact issues **before** merge or release: access control, injection, secrets, crypto, dependencies.
- Produce actionable, severitized findings with repro hints — not generic fear.

## Priority order (first pass)

1. **AuthN / AuthZ** — who can call what on which objects?  
2. **Injection and deserialization** — SQL, command, template, unsafe JSON/XML.  
3. **Secrets and PII** — logs, errors, client bundles, repo history.  
4. **Dependencies and config** — known CVEs, debug flags, insecure defaults.

## OWASP Top 10 (at a glance)

Use as a **coverage map**; open [owasp-prompts](./references/owasp-prompts.md) for question lists per category.

| # | Theme |
|---|--------|
| A01–A02 | Access control · Crypto failures |
| A03–A04 | Injection · Insecure design |
| A05–A06 | Misconfiguration · Vulnerable components |
| A07–A08 | Auth failures · Integrity failures |
| A09–A10 | Logging gaps · SSRF |

## When to open lazy depth

- You need expanded checklists, the full report skeleton, or command examples per language — pick a row in the table above.

## Related skills

- Code-level review: [code-review/SKILL.md](../code-review/SKILL.md)  
- Debugging suspected exploits: [debugging/SKILL.md](../debugging/SKILL.md)
