# Review Checklist Template
# Dùng bởi: Lead Agent tự fill trước khi submit Approval Request
# File: workflows/steps/NN-[step-name]/review-checklist.md

---

# Review Checklist — Step [N]: [Step Name]

**Agent**: @[role]  
**Ngày điền**: YYYY-MM-DD

> Điền checklist này TRƯỚC khi tạo Approval Request.
> Mọi item `[ ]` chưa check phải có ghi chú lý do (N/A hoặc blocker).

---

## A. Definition of Done — Global (Mọi Step)

- [ ] Tất cả deliverables đã hoàn thành (hoặc deferred với lý do rõ ràng)
- [ ] `flowctl collect` chạy thành công — state cập nhật
- [ ] `flowctl gate-check` pass (hoặc bypass với quyết định rõ ràng từ PM)
- [ ] Step Summary document đã được tạo (`workflows/steps/NN-*/summary.md`)
- [ ] Approval Request đã được chuẩn bị từ template
- [ ] Tất cả decisions quan trọng đã được ghi vào flowctl state
- [ ] Open blockers = 0 (hoặc được PM acknowledge là acceptable)

---

## B. Step-specific Criteria — Step [N]

> Thay `[Step N]` bằng tên step thực tế. Xóa dòng không áp dụng, thêm dòng nếu cần.

**Step 1 — Requirements:**
- [ ] Tất cả user stories có Acceptance Criteria dạng BDD
- [ ] MoSCoW prioritization confirmed với stakeholder
- [ ] Tech Lead đã confirm feasibility
- [ ] Scope (in/out) được define rõ ràng

**Step 2 — System Design:**
- [ ] Architecture diagram hoàn chỉnh
- [ ] Tất cả ADRs có rationale
- [ ] OpenAPI spec draft hoàn thành
- [ ] Database ERD reviewed

**Step 3 — UI/UX:**
- [ ] Tất cả screens / flows được design
- [ ] Responsive (mobile + desktop)
- [ ] Accessibility specs included (WCAG 2.1 AA)
- [ ] Design tokens exportable

**Step 4 — Backend:**
- [ ] Tất cả API endpoints implement và tested
- [ ] Test coverage >= 80%
- [ ] SAST scan pass (no Critical/High)
- [ ] All migrations reversible

**Step 5 — Frontend:**
- [ ] Tất cả screens implemented
- [ ] Accessibility audit pass (axe-core)
- [ ] Core Web Vitals đạt targets
- [ ] TypeScript: 0 errors

**Step 6 — Integration:**
- [ ] Contract tests pass
- [ ] E2E happy paths verified
- [ ] Error scenarios tested

**Step 7 — QA:**
- [ ] Test execution rate >= 98%
- [ ] Open Critical/High bugs = 0
- [ ] Go/No-Go recommendation document

**Step 8 — DevOps:**
- [ ] Staging stable >= 24 giờ
- [ ] Rollback procedure tested
- [ ] Monitoring / alerting configured

**Step 9 — Release:**
- [ ] All Acceptance Criteria met
- [ ] UAT sign-off received
- [ ] Release notes approved

---

## C. Quality Gates Passed

| Gate | Tool / Command | Result |
|------|---------------|--------|
| Flowctl gate | `flowctl gate-check` | PASS / FAIL |
| Evidence integrity | `flowctl release-dashboard --no-write` → `approval_ready` | yes / no |
| [Step-specific gate, e.g. test coverage] | [command] | [result] |

---

## D. Sign-off

- [ ] Tôi đã review toàn bộ checklist này
- [ ] Tất cả `[ ]` chưa check đều có ghi chú N/A hoặc blocker bên dưới

**Ghi chú cho items chưa đạt:**

> [Điền nếu có — ví dụ: "B.Step4.SAST: N/A — step này không có code changes"]

**Approval Request đã tạo tại:** `workflows/steps/[NN]-[name]/approval-request.md`
