# Documentation: ADR detail, changelog & release notes

> Lazy reference — [SKILL.md](../SKILL.md)

## 4. Architecture Decision Records (ADR)

### 4.1 ADR Template Chi Tiết

```markdown
# ADR-{NNN}: {Decision Title}

**Ngày tạo**: {YYYY-MM-DD}
**Tác giả**: Tech Lead Agent
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-{N}
**Được review bởi**: {PM, Tech Lead, relevant devs}

## Context

{Mô tả bối cảnh và vấn đề cần giải quyết. Trả lời câu hỏi:
- Chúng ta đang ở đâu?
- Chúng ta cần giải quyết vấn đề gì?
- Các constraints là gì (technical, business, team)?}

## Problem Statement

{Phát biểu vấn đề một cách súc tích và rõ ràng.}

## Decision

{Quyết định được đưa ra. Một câu rõ ràng, không mơ hồ.}

**Chúng ta sẽ sử dụng {technology/approach} cho {purpose}.**

## Rationale

{Tại sao quyết định này được chọn. Include:
- Tại sao option này tốt hơn các alternatives
- Alignment với các constraints đã identify
- Evidence hoặc data hỗ trợ quyết định này}

## Alternatives Considered

### Option A: {Alternative 1 Name}
**Description**: {Mô tả option}

**Pros**:
- {Advantage 1}
- {Advantage 2}

**Cons**:
- {Disadvantage 1}
- {Disadvantage 2}

**Why not chosen**: {Lý do không chọn option này}

### Option B: {Alternative 2 Name}
{Same format}

## Consequences

### Positive Consequences
- {Benefit 1}
- {Benefit 2}

### Negative Consequences / Trade-offs
- {Trade-off 1}: {How we'll manage this}
- {Technical debt incurred}: {Plan to address}

### Risks
- **{Risk}**: {Probability: High/Med/Low} | {Impact: High/Med/Low}
  → Mitigation: {How to mitigate}

## Implementation Notes

{Hướng dẫn implement decision này nếu cần.
Links đến relevant resources.}

## Related Decisions

- ADR-{id}: {Relationship - "Supersedes" / "Related to" / "Enabled by"}

## Review History

| Date | Action | Reviewer | Notes |
|------|--------|----------|-------|
| {date} | Proposed | {name} | Initial draft |
| {date} | Accepted | Tech Lead + PM | Minor changes to consequence section |
```

### 4.2 Khi Nào Tạo ADR

Tạo ADR khi:
- Chọn primary technology (language, framework, database, cloud)
- Chọn architecture pattern (microservices vs monolith, event-driven vs REST)
- Data storage strategy (SQL vs NoSQL, sharding approach)
- Authentication/authorization approach
- Third-party service integrations
- Deployment strategy (containers, serverless, bare metal)
- Coding conventions departing from standard
- Performance trade-offs (cache-aside vs write-through)

KHÔNG cần ADR cho:
- Routine implementation details
- Bug fixes
- Minor dependency updates
- Style/formatting choices (covered by linters)

## 5. Changelog và Release Notes

### 5.1 CHANGELOG.md Format (Keep a Changelog)

```markdown
# Changelog

All notable changes to this project will be documented in this file.
Format: [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- {Feature được thêm}

### Changed
- {Thay đổi existing functionality}

### Deprecated
- {Feature sẽ bị remove trong tương lai}

### Removed
- {Feature đã bị remove}

### Fixed
- {Bug fixes}

### Security
- {Security fixes - important!}

---

## [1.0.0] - 2026-04-23

### Added
- User authentication with JWT (US-001, US-002)
- Product catalog with search and filtering (US-010 - US-015)
- Shopping cart and checkout flow (US-020 - US-025)
- Order management dashboard for admins (US-030)
- Email notifications for order status changes (US-031)

### Security
- Implemented rate limiting on all auth endpoints
- Added input sanitization for all user-provided content

---

## [0.9.0-beta] - 2026-04-01

### Added
- Beta version for internal testing
```

### 5.2 Release Notes Template (User-facing)

```markdown
# Release Notes - v{version} ({YYYY-MM-DD})

## Tính Năng Mới 🎉

### {Feature Name}
{Mô tả tính năng bằng ngôn ngữ của người dùng cuối.
Focus vào value/benefit, không phải technical detail.}

**Cách sử dụng**: {Brief instructions}

---

## Cải Tiến ✨

- **{Improvement}**: {Mô tả cải tiến và lợi ích}
- **Performance**: {Ứng dụng giờ nhanh hơn X% khi...}

## Sửa Lỗi 🐛

- **{Bug description}**: {Mô tả lỗi và cách đã fix}
- **{Bug description}**: {Mô tả}

## Known Issues ⚠️

- **{Issue}**: {Mô tả issue và workaround nếu có}
  *Dự kiến fix trong v{next-version}*

## Breaking Changes (nếu có) ⛔

{IMPORTANT: Những thay đổi yêu cầu action từ user/developer}

- **{Change}**: {Mô tả và migration steps}

## Upgrade Guide

{Hướng dẫn upgrade nếu có special steps}

---
*Cảm ơn đã sử dụng {Product Name}!*
*Support: support@example.com*
```

