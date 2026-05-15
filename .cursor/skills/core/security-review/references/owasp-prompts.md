# Security review — OWASP Top 10 prompts

> Lazy reference — [SKILL.md](../SKILL.md)

Align PR severity labels with `.cursor/rules/review-rules.mdc` where applicable.

## 1. OWASP Top 10 (2021) — expanded prompts

| # | Risk | Deep checks |
|---|------|-------------|
| A01 Broken access control | Object-level authz; IDOR on UUID/int; admin-only routes gated; horizontal privilege |
| A02 Cryptographic failures | TLS version, cipher suites, at-rest encryption for PII, key rotation story |
| A03 Injection | SQL/NoSQL/OS/command; template injection; safe wrappers for dynamic queries |
| A04 Insecure design | Threat modeling notes; abuse cases; rate limits on expensive or sensitive ops |
| A05 Security misconfiguration | Default accounts, debug stacks exposed, verbose errors in prod |
| A06 Vulnerable components | Lockfile audit, transitive CVEs, unmaintained deps |
| A07 Identification and auth failures | Session fixation, weak MFA policy, credential stuffing mitigations |
| A08 Software and data integrity failures | Unsigned CI artifacts, unsafe deserialization |
| A09 Security logging and monitoring failures | Tamper-evident logs, no secrets in logs, alert paths |
| A10 SSRF | URL fetchers, webhooks, preview features hitting internal IPs/metadata |
