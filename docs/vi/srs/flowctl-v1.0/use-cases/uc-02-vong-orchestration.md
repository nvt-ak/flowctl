# Use Case: Vòng orchestration theo bước workflow

**Use Case ID:** UC-02  
**Version:** 1.0  
**Status:** Draft

---

## 1. Use Case Overview

**Use Case Name:** Chạy vòng orchestration (complexity → War Room (tuỳ điều kiện) → dispatch → collect → gate)

**Brief Description:**  
PM/Developer điều phối bước hiện tại: tính điểm phức tạp, có thể bắt buộc War Room, sinh brief và lệnh worker, chạy headless/manual, thu thập báo cáo vào state, capture evidence, đánh giá QA gate — theo wiki **Workflow orchestration engine**.

**Actor(s):**
- **Primary Actor:** PM / Orchestrator
- **Secondary Actor:** Developer (chạy worker, `team sync`)

**Priority:** High

**Preconditions:**
- State đã khởi tạo; bước hiện tại xác định trong `flowctl-state.json`
- Policy/budget file có hoặc engine fallback (wiki: budget policy missing → ALLOW)

**Postconditions:**
- Báo cáo `*-report.md` được quét vào state khi collect
- Manifest evidence (nếu chạy capture) và kết quả gate ghi nhận

**Trigger:** Lệnh `flowctl cursor-dispatch`, `flowctl dispatch`, `flowctl collect`, `flowctl gate-check`, hoặc `flowctl team …` tùy luồng.

---

## 2. Main Success Scenario (Basic Flow)

1. Actor chạy `cursor-dispatch` (Phase 0): tính `wf_complexity_score`, so sánh `WF_WAR_ROOM_THRESHOLD` (mặc định 4); nếu cần thì War Room, bump `dispatch_count`, refresh brief, ghi `spawn-board.txt`.
2. Actor chạy `dispatch`: tạo `run_id`, thư mục dispatch, idempotency, sinh `{role}-brief.md`, `agent-commands.txt`.
3. Worker thực thi (manual / `--launch` / `--headless`); headless: pipeline `timeout … agent … | stream_json_capture.py`.
4. Actor chạy `collect`: ingest `DECISION:`, `BLOCKER:`, `DELIVERABLE:` từ report; cập nhật idempotency completed; unverified deliverables; evidence capture; budget mark completed; mercenary scan nếu có.
5. Hệ thống `wf_evaluate_gate` + verify evidence theo wiki.
6. Use case kết thúc với tín hiệu gate phù hợp policy `qa-gate.v1.json`.

---

## 3. Alternative Flows

### 3.1 Budget breaker OPEN

**Condition:** `wf_budget_prelaunch_check` trả `BLOCK|breaker=open` hoặc cap.

**Flow:** Không launch worker (trừ dry-run / override theo policy một lần mỗi run — wiki).

### 3.2 Idempotency SKIP

**Condition:** Key đã `completed` / đang `launching` hợp lệ.

**Flow:** Bỏ qua launch; operator dùng `team recover` nếu stale (wiki).

---

## 4. Special Requirements

Exit code contract dispatch: `0` success, `1` logical/I/O/JSON, `2` policy violation, `255` Python failure (wiki).

**SRS Reference:** Section 4 — F-01.
