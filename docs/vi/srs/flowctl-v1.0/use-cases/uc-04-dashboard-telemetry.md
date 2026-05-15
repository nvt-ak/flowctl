# Use Case: Dashboard telemetry cục bộ

**Use Case ID:** UC-04  
**Version:** 1.0  
**Status:** Draft

---

## 1. Use Case Overview

**Use Case Name:** Quan sát MCP cache, token, workflow qua `flowctl monitor`

**Brief Description:**  
Chạy `scripts/monitor-web.py` (mặc định qua `flowctl monitor`): HTTP + SSE, đọc `session-stats.json`, `events.jsonl`, `flowctl-state.json`, hỗ trợ multi-project discovery — theo wiki **Workflow telemetry dashboard**.

**Actor(s):**
- **Primary Actor:** Developer

**Priority:** Medium

**Preconditions:**
- File telemetry/cache tồn tại hoặc rỗng (UI xử lý)
- Port local khả dụng (mặc định 3170, bump nếu busy)

**Postconditions:**
- Server HTTP chạy tại `127.0.0.1:<port>`; client nhận SSE updates

**Trigger:** `flowctl monitor` hoặc chạy script Python trực tiếp.

---

## 2. Main Success Scenario (Basic Flow)

1. `flowctl.sh` export `FLOWCTL_PROJECT_ROOT`, cache paths (v1.1+ wiki).
2. `main()` resolve port, khởi động `FileWatcher` + `ThreadingHTTPServer`.
3. Browser/agent mở `/` hoặc gọi `/api/data`, subscribe `/api/stream`.
4. Khi `events.jsonl` / stats / state đổi mtime, SSE broadcast `project_update`.
5. Use case tiếp tục cho đến khi shutdown (SIGINT/SIGTERM).

---

## 3. Alternative Flows

### 3.1 `--once`

**Condition:** CLI flag `--once`.

**Flow:** In JSON `build_api_data()` ra stdout, thoát — không mở server.

---

## 4. Special Requirements

Bind `127.0.0.1` only — dev tool, không LAN mặc định (wiki).  
`ThreadingHTTPServer` + daemon threads để SSE không block (wiki).

**SRS Reference:** Section 4 — F-03.
