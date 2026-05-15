# Use Case: Audit token / MCP events

**Use Case ID:** UC-05  
**Version:** 1.0  
**Status:** Draft

---

## 1. Use Case Overview

**Use Case Name:** Phân tích log MCP và thống kê token

**Brief Description:**  
`flowctl audit-tokens` / `audit` gọi `scripts/token-audit.py`: đọc `events.jsonl`, phân loại overhead vs work, hỗ trợ báo cáo table/markdown/json, tùy chọn đối chiếu Graphify graph health — theo wiki **Token usage auditing**.

**Actor(s):**
- **Primary Actor:** Developer

**Priority:** Medium

**Preconditions:**
- `FLOWCTL_EVENTS_F` trỏ file JSONL (hoặc default dưới cache)

**Postconditions:**
- Báo cáo in ra stdout theo format chọn

**Trigger:** `flowctl audit` hoặc `flowctl audit-tokens` với tham số wiki mô tả.

---

## 2. Main Success Scenario (Basic Flow)

1. Script resolve `REPO_ROOT`, `EVENTS_FILE`, `STATS_FILE`.
2. `load_events()` đọc và lọc theo `--days` / `--step` nếu có.
3. Nếu không có event sau filter → in thông báo ngắn, thoát (wiki).
4. Ngược lại: `analyze()` / `analyze_by_task()` và `print_report()`.

---

## 3. Special Requirements

**Ghi chú nguồn:** Trang wiki tên file có typo `token-token-audit.py`; **mã nguồn thực tế:** `scripts/token-audit.py` (theo wiki CLI mapping và repo).

**SRS Reference:** Section 4 — F-04.
