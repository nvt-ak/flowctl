## F-01 Workflow orchestration engine

### F-01.1 Description

**Feature Name:** Workflow orchestration engine (`scripts/workflow/lib/`)

**Priority:** High

**Brief Description:**  
Runtime đọc/ghi `flowctl-state.json`, áp dụng policy/budget/idempotency, sinh brief worker, dispatch (manual/launch/headless), collect báo cáo, capture evidence SHA-256, evaluate QA gate, mercenary scan — theo wiki **Workflow orchestration engine**.

**User Story:**  
**As a** PM orchestrator, **I want to** chạy dispatch/collect/gate trên một bước **so that** trạng thái workflow và bằng chứng được cập nhật nhất quán.

**Feature Scope — In Scope:**  
Lock repo; complexity + War Room gating; `cmd_dispatch` modes và exit codes; budget breaker; collect + evidence; gate `qa-gate.v1.json`; mercenary Phase B; `cmd_team` loop.

**Feature Scope — Out of Scope:**  
Chi tiết triển khai từng dòng shell (xem source); sản phẩm business của repo consumer.

**Related Use Cases:** UC-02

---

### F-01.2 Stimulus/Response Sequences

**Sequence 1: Headless dispatch → collect**

| Step | Actor/Action | System Response |
|------|----------------|-----------------|
| 1 | PM chạy `flowctl dispatch --headless` | Sinh brief, idempotency LAUNCH nếu hợp lệ, fork pipeline agent |
| 2 | Worker hoàn thành | Log/stream_json_capture cập nhật heartbeat |
| 3 | PM chạy `flowctl collect` | Parse report lines vào state; evidence manifest; mark budget done |
| 4 | PM chạy gate / gate-check | `wf_evaluate_gate`, verify evidence theo policy |

---

### F-01.3 Functional Requirements

| Req ID | Requirement Description | Priority | Status |
|--------|---------------------------|----------|--------|
| FR-01-01 | Hệ thống phải tính `wf_complexity_score` và tier `MICRO`/`STANDARD`/`FULL` từ state bước 1–5 | High | Draft |
| FR-01-02 | `cmd_dispatch` từ chối kết hợp `--launch` và `--headless` đồng thời | High | Draft |
| FR-01-03 | Exit code: `0` OK, `1` lỗi logic/I/O/JSON, `2` `POLICY_VIOLATION`, `255` lỗi Python không mong đợi | High | Draft |
| FR-01-04 | Budget: nếu thiếu policy file → `ALLOW|budget policy missing; guard disabled` (wiki) | Medium | Draft |
| FR-01-05 | Collect phải surface deliverable path không tồn tại disk là unverified (ảnh hưởng gate) | High | Draft |
| FR-01-06 | Evidence: `wf_evidence_verify_step` hard-fail nếu manifest khớp nhưng hash không khớp | High | Draft |

**Error Handling (tiêu biểu):**  
`POLICY_VIOLATION`, `BLOCK|breaker=open`, `SKIP|already launched`, `EVIDENCE_FAIL`, `GATE_FAIL` — điều kiện và lớp xử lý theo bảng troubleshooting wiki.

---

**Data Requirements:**  
`flowctl-state.json`, `idempotency.json`, `budget-state.json`, `budget-events.jsonl`, `workflows/dispatch/step-N/*`, `EVIDENCE_DIR` manifests — chi tiết field-level: **TBD — lấy từ JSON schema nếu cần chứng minh formal** (wiki mô tả hành vi, không dán schema đầy đủ).

**User Interface Requirements:**  
CLI / markdown brief — không có GUI sản phẩm trong F-01.

**Dependencies:**  
Python `context_snapshot.py`, `stream_json_capture.py`; policy JSON; optional Graphify/GitNexus text trong brief (bước 4–8).
