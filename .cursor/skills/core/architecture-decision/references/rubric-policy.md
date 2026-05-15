# Scoring, when-to-ADR, alternatives, Graphify note

> Lazy reference — [SKILL.md](../SKILL.md)

## 2. Scoring rubric (1–5 per axis)

Score each **viable** option; total or weighted sum is advisory, not automatic.

| Axis | What to score |
|------|----------------|
| **Performance** | Latency, throughput, tail behavior |
| **Scalability** | Horizontal/vertical headroom, bottlenecks |
| **Maintainability** | Team skill, operational burden, clarity |
| **Reliability** | Failure modes, recovery, blast radius |
| **Security** | Attack surface, data exposure, compliance |
| **Cost** | Infra, licensing, build vs buy, ongoing toil |

Document disagreements explicitly when scores conflict.

## 3. When an ADR is required vs optional

**Required (typical):**

- Primary datastore, broker, cache, or search technology
- AuthN/AuthZ model or identity provider strategy
- Deployment topology (monolith vs services, regions)
- API versioning or breaking-change policy
- Anything where rollback or rework exceeds ~1 developer-day

**Optional / skip:**

- Small library picks with easy swap-out
- Naming or formatting conventions
- Refactorable implementation details inside an agreed boundary

## 4. Lightweight alternatives

For **small** decisions, a short subsection in the step design doc or a single OpenAPI `description` may suffice; still link from an ADR index if you create `docs/adr/README.md`.

## 5. Graphify note

Graphify tracks **code** structure only. ADR content belongs in `docs/adr/` and workflow state — do not treat Graphify as the ADR registry.
