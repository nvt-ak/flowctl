# Review Checklists Per Step
# Load only during: flowctl collect / approval preparation
# Version: 3.0.0 | Updated: 2026-05-13

---

## Step 1 — Requirements Analysis

**Reviewers**: PM + 1 Stakeholder representative

| Criterion | Check |
|-----------|-------|
| All user stories have clear Acceptance Criteria | Yes/No |
| User stories follow BDD format (Given/When/Then) | Yes/No |
| MoSCoW prioritization confirmed by stakeholder | Yes/No |
| Technical feasibility confirmed by Tech Lead | Yes/No |
| Business objectives are clear and measurable | Yes/No |
| Scope clearly defined (in-scope and out-of-scope) | Yes/No |
| Dependencies identified | Yes/No |
| Graphify knowledge graph complete | Yes/No |

**Required Artifacts:**
- [ ] Product Requirements Document (PRD)
- [ ] User Story Map
- [ ] Priority matrix (MoSCoW)
- [ ] Stakeholder sign-off document

---

## Step 2 — System Design

**Reviewers**: Tech Lead + PM + (optional) Security Reviewer

| Criterion | Check |
|-----------|-------|
| Architecture diagram clear and complete | Yes/No |
| All ADRs documented with rationale | Yes/No |
| API contracts defined (OpenAPI spec) | Yes/No |
| Database schema reviewed and approved | Yes/No |
| Non-functional requirements addressed | Yes/No |
| Security architecture reviewed (threat model) | Yes/No |
| Scalability designed for projected load | Yes/No |
| Tech stack decisions documented and justified | Yes/No |

**Required Artifacts:**
- [ ] System Architecture Document with diagrams
- [ ] Architecture Decision Records (ADRs)
- [ ] OpenAPI specification draft
- [ ] Database Entity Relationship Diagram (ERD)
- [ ] Non-functional requirements specification
- [ ] Technology stack rationale

---

## Step 3 — UI/UX Design

**Reviewers**: UI/UX + PM + Frontend Dev (feasibility check)

| Criterion | Check |
|-----------|-------|
| All screens/views designed | Yes/No |
| Design system (tokens) defined | Yes/No |
| Responsive design (mobile, tablet, desktop) | Yes/No |
| Accessibility specs included | Yes/No |
| User flows documented | Yes/No |
| Component library complete | Yes/No |
| Design tokens exportable for dev handoff | Yes/No |
| PM confirms design meets requirements | Yes/No |

**Required Artifacts:**
- [ ] Figma file with all screens and components
- [ ] Design system documentation
- [ ] Design tokens (JSON export)
- [ ] User flow diagrams
- [ ] Responsive design specs
- [ ] Accessibility annotations
- [ ] Component usage guidelines

---

## Step 4 — Backend Development

**Reviewers**: Tech Lead (mandatory)

| Criterion | Check |
|-----------|-------|
| All API endpoints implemented and tested | Yes/No |
| OpenAPI spec updated and accurate | Yes/No |
| Test coverage ≥ 80% | Yes/No |
| SAST scan passed (no Critical/High findings) | Yes/No |
| All migrations reversible and tested | Yes/No |
| Authentication and authorization correct | Yes/No |
| Performance benchmarks met | Yes/No |
| Code review by Tech Lead completed | Yes/No |

**Required Artifacts:**
- [ ] All feature PRs merged into develop
- [ ] Updated OpenAPI specification
- [ ] Test coverage report (≥ 80%)
- [ ] SAST scan results
- [ ] Performance benchmark results
- [ ] Database migration files
- [ ] API integration guide for frontend

---

## Step 5 — Frontend Development

**Reviewers**: Tech Lead + UI/UX Designer

| Criterion | Check |
|-----------|-------|
| All screens implemented | Yes/No |
| Design fidelity — pixel perfect | Yes/No |
| Responsive across all breakpoints | Yes/No |
| Accessibility audit passed (axe-core) | Yes/No |
| Core Web Vitals meet targets | Yes/No |
| Component test coverage ≥ 80% | Yes/No |
| TypeScript: 0 errors | Yes/No |
| UI/UX sign-off received | Yes/No |

**Required Artifacts:**
- [ ] All feature PRs merged
- [ ] Component test coverage report
- [ ] Lighthouse scores (≥ 90)
- [ ] Accessibility audit report
- [ ] Cross-browser test results
- [ ] Storybook stories for all components
- [ ] UI/UX design review sign-off

---

## Step 6 — Integration Testing

**Reviewers**: Tech Lead

| Criterion | Check |
|-----------|-------|
| All integration points tested | Yes/No |
| API contracts verified (contract tests) | Yes/No |
| All happy paths working end-to-end | Yes/No |
| Error handling tested (network, timeout, API errors) | Yes/No |
| Performance integration test passed | Yes/No |
| Data flow verified end-to-end | Yes/No |
| Third-party integrations verified | Yes/No |

**Required Artifacts:**
- [ ] Integration test results report
- [ ] Contract test results
- [ ] E2E test results (happy paths)
- [ ] Error scenario test results
- [ ] Performance test results
- [ ] Integration issues log and resolutions

---

## Step 7 — QA Testing

**Reviewers**: QA + PM

| Criterion | Threshold | Actual |
|-----------|-----------|--------|
| Test case execution rate | ≥ 98% | {actual} |
| Test pass rate | ≥ 95% | {actual} |
| Open Critical bugs | = 0 | {actual} |
| Open High bugs | = 0 | {actual} |
| Security scan (DAST) | Clean | {actual} |
| Backend API p95 | < 500ms | {actual} |
| Accessibility (axe) | 0 critical | {actual} |

**Required Artifacts:**
- [ ] Test execution report
- [ ] Bug report with traceability matrix
- [ ] Performance test report (k6/JMeter)
- [ ] Security scan report (OWASP ZAP)
- [ ] Accessibility audit report
- [ ] Go/No-Go recommendation document

---

## Step 8 — DevOps Deployment

**Reviewers**: DevOps + Tech Lead + PM

| Criterion | Check |
|-----------|-------|
| All environments provisioned and healthy | Yes/No |
| CI/CD pipeline — all stages pass | Yes/No |
| Staging deployment stable ≥ 24h | Yes/No |
| Monitoring and alerting configured | Yes/No |
| Rollback procedure tested | Yes/No |
| Security scan (Trivy, SAST) passed | Yes/No |
| SSL/TLS certificates valid | Yes/No |
| Database backups verified | Yes/No |

**Required Artifacts:**
- [ ] Infrastructure architecture document
- [ ] CI/CD pipeline documentation
- [ ] Deployment runbook
- [ ] Monitoring dashboard URLs
- [ ] Security scan reports
- [ ] Rollback test evidence
- [ ] Performance test results on staging

---

## Step 9 — Release Review (Final Approval)

**Reviewers**: PM + Tech Lead + Stakeholder

| Criterion | Check |
|-----------|-------|
| All Acceptance Criteria met | Yes/No |
| QA Go/No-Go: GO | Yes/No |
| UAT sign-off from stakeholders | Yes/No |
| Release notes approved | Yes/No |
| Production deployment successful | Yes/No |
| Post-release monitoring in place | Yes/No |
| Rollback plan ready if needed | Yes/No |

**Required Artifacts:**
- [ ] Release notes (user-facing and technical)
- [ ] UAT sign-off document
- [ ] Final QA report
- [ ] Production deployment evidence
- [ ] Post-release monitoring plan
- [ ] Known issues and workarounds (if any)
- [ ] Lessons learned document
