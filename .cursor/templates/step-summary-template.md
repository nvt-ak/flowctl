# Step Summary Template
# Dùng bởi: Lead Agent khi kết thúc step | File: workflows/steps/NN-[step-name]/summary.md

---

# Step [N]: [Step Name] — Summary

**Lead Agent**: @[role]  
**Ngày hoàn thành**: YYYY-MM-DD  
**Duration thực tế**: [X ngày] (Planned: [Y ngày])  
**Status**: [Completed / Partially completed — ghi rõ nếu partial]

---

## Executive Summary

> 5-10 câu cho PM và stakeholders — không kỹ thuật, focus vào outcomes và business value.

[Mô tả ngắn gọn những gì đã đạt được, tại sao quan trọng, và step tiếp theo cần gì.]

---

## Technical Summary

> Dành cho Tech Lead và developers — chi tiết implementation, architecture decisions, trade-offs.

[Mô tả technical approach, patterns sử dụng, infrastructure changes, integration points.]

---

## Deliverables Hoàn Thành

| Deliverable | Location | Status |
|-------------|----------|--------|
| [Tên file / document] | `[đường dẫn]` | ✓ Done |
| [Tên file / document] | `[đường dẫn]` | ✓ Done |
| [Item defer sang step sau nếu có] | — | ⚠ Deferred |

---

## Metrics Đạt Được

| KPI | Target | Actual | Status |
|-----|--------|--------|--------|
| [Ví dụ: Test coverage] | >= 80% | X% | ✓ / ✗ |
| [Ví dụ: Stories completed] | N | N | ✓ / ✗ |
| [Ví dụ: Performance p95] | < 500ms | Xms | ✓ / ✗ |

---

## Issues Gặp Phải & Giải Pháp

| Issue | Severity | Giải pháp | Status |
|-------|----------|-----------|--------|
| [Mô tả issue] | High/Med/Low | [Cách resolve] | Resolved / Open |

_(Không có issue = ghi "Không có issue đáng kể trong step này")_

---

## Lessons Learned

> Bài học cho các steps tương lai — cả kỹ thuật lẫn process.

1. **[Lesson 1]**: [Mô tả ngắn + recommendation]
2. **[Lesson 2]**: [Mô tả ngắn + recommendation]

_(Tối thiểu 1 lesson — luôn có điều gì đó để cải thiện)_

---

## Dependencies Cho Step Tiếp Theo

> Những gì step [N+1] cần từ step này — handoff checklist.

- [ ] [Artifact / decision / access cần thiết] — @[agent nhận] cần biết: [ghi chú]
- [ ] [Artifact / decision / access cần thiết] — @[agent nhận] cần biết: [ghi chú]

**Handoff notes cho @[next-lead-agent]:**
> [Gotchas, assumptions, known issues mà next agent cần biết ngay]

---

## Flowctl State Update

```bash
# Verify state sau collect:
flowctl status
flowctl gate-check
flowctl release-dashboard --no-write
```

Decisions đã ghi vào state: [N] decisions  
Blockers resolved: [N] / [Total]  
Evidence manifest: `workflows/runtime/evidence/step-[N]-manifest.json`
