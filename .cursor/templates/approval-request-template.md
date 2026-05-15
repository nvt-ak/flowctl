# Approval Request Template
# Dùng bởi: Lead Agent cuối mỗi step | Đọc bởi: PM + Approvers

---

## 🔔 APPROVAL REQUEST — Step [N]: [Step Name]

**Agent**: @[role]  
**Ngày hoàn thành**: YYYY-MM-DD  
**Duration**: [X ngày / X giờ]  
**Flowctl gate**: `flowctl gate-check` → [PASS / FAIL + lý do bypass nếu có]

---

## Executive Summary

> 2-3 câu plain language cho PM đọc — không kỹ thuật, tập trung vào business outcome.

[Ví dụ: "Requirements cho snapbox-effect-api đã được thu thập và phân tích đầy đủ.
Tất cả 12 user stories đã có Acceptance Criteria dạng BDD và được tech lead confirm feasibility.
Scope được define rõ ràng với 4 must-have, 3 should-have features."]

---

## Deliverables Hoàn Thành

- [x] [Tên deliverable 1] → `[đường dẫn file hoặc link]`
- [x] [Tên deliverable 2] → `[đường dẫn file hoặc link]`
- [ ] [Deliverable chưa xong — ghi rõ lý do nếu cần defer]

---

## Decisions Made

| Quyết định | Rationale |
|------------|-----------|
| [Decision 1 ngắn gọn] | [1 câu lý do] |
| [Decision 2 ngắn gọn] | [1 câu lý do] |

---

## Risks Nếu Approve As-Is

- **[Risk 1]**: [Mô tả ngắn] — Likelihood: [Low/Med/High] — Impact: [Low/Med/High]
- **[Risk 2]**: [Mô tả ngắn] — Likelihood: [Low/Med/High] — Impact: [Low/Med/High]
- _(Không có risk = xóa section này)_

---

## Assumptions PM Nên Verify

- [ ] [Assumption 1 — điền nếu có assumption không chắc chắn]
- [ ] [Assumption 2]
- _(Không có = xóa section này)_

---

## Conditions Nếu APPROVE WITH CONDITIONS

> Chỉ điền nếu có items cần fix sau approval. Xóa section này nếu clean approve.

Phải hoàn thành trong [48 giờ / N ngày]:

1. [Condition 1] — Owner: @[agent] — Due: YYYY-MM-DD
2. [Condition 2] — Owner: @[agent] — Due: YYYY-MM-DD

---

## Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| [Ví dụ: Test coverage] | [>= 80%] | [X%] |
| [Ví dụ: Stories with AC] | [100%] | [X%] |
| [Thêm metrics phù hợp với step] | | |

---

## Quyết Định Cần Thiết

```
[ ] APPROVE          → Proceed to Step [N+1]
[ ] APPROVE WITH CONDITIONS  → Proceed + fix items above trong [48h]
[ ] REJECT           → Address concerns → Re-submit
```

**Người approve**: @pm [+ @tech-lead nếu step kỹ thuật]

```bash
# Chạy sau khi quyết định:
flowctl approve --by "Tên PM"
# hoặc:
flowctl conditional "condition 1; condition 2"
# hoặc:
flowctl reject "Lý do từ chối"
```

---

> **Note**: Worker Report ≠ Approval Request.
> Worker reports (`workflows/dispatch/step-[N]/reports/`) là raw output của từng agent.
> Document này là synthesis của PM/lead agent sau `flowctl collect`, dùng để PM ra quyết định.
