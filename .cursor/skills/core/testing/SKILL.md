---
name: testing
description: "Testing strategy and execution patterns across unit, integration, and E2E"
triggers: ["test", "qa", "regression", "coverage"]
when-to-use: "Use when designing, implementing, or reviewing automated test strategy and suites."
when-not-to-use: "Do not use for architecture tradeoff decisions without test implementation scope."
prerequisites: []
estimated-tokens: 750
roles-suggested: ["qa", "backend", "frontend", "tech-lead"]
version: "1.1.0"
tags: ["testing", "quality"]
---

# Testing (compact)

**Lazy depth:** `references/*.md` — see `manifest.json` → `lazy` for id `testing`. Open **only** the topics you need; do not preload.

| Topic | Open |
|-------|------|
| Strategy + unit | [references/strategy-unit.md](./references/strategy-unit.md) |
| Integration | [references/integration.md](./references/integration.md) |
| E2E / Playwright | [references/e2e-playwright.md](./references/e2e-playwright.md) |
| k6 + a11y | [references/performance-a11y.md](./references/performance-a11y.md) |
| Data, coverage, links | [references/data-coverage-links.md](./references/data-coverage-links.md) |

## Strategy

- **Unit:** fast, isolated, highest volume — pure logic, domain rules, small adapters with fakes.  
- **Integration:** service boundaries — HTTP APIs, databases, brokers; prefer real dependencies in CI when practical (e.g. Testcontainers) or high-fidelity fakes where not.  
- **E2E:** a small set of journeys that prove critical user value; invest in stability (selectors, waits, isolation).

## Unit habits

- Arrange → Act → Assert; one behavior per test; name tests after behavior, not methods.  
- Prefer test doubles that preserve behavior contracts; avoid over-mocking implementation details.

## Integration and E2E

- Assert HTTP status, schema, auth, and side effects; reset data between tests.  
- For browser tests: page objects or composable helpers; quarantine flaky specs; run critical path in CI.

## Non-functional checks

- **Performance:** load or soak tests where SLOs exist (project standard, e.g. k6).  
- **Accessibility:** automated axe checks on key flows plus manual keyboard and screen-reader spot checks.

## Coverage

- Meet project thresholds from `.cursor/rules/core-rules.mdc`; when CI supports it, watch coverage on changed lines for risky modules.

## When to open lazy depth

- You need ready-made config snippets, long checklists, or copy-paste examples — pick a row above.

## Related skills

- Code review for test quality: [code-review/SKILL.md](../code-review/SKILL.md)
