## F-03 Workflow telemetry dashboard

### F-03.1 Description

**Feature Name:** `scripts/monitor-web.py` (`flowctl monitor`)

**Priority:** Medium

**Brief Description:**  
HTTP API cục bộ + SSE; đọc stats/events/state; multi-project discovery qua `~/.flowctl/projects/*/meta.json` và registry — wiki **Workflow telemetry dashboard**.

**Related Use Cases:** UC-04

---

### F-03.3 Functional Requirements

| Req ID | Requirement Description | Priority | Status |
|--------|---------------------------|----------|--------|
| FR-03-01 | Endpoints: `/`, `/api/data`, `/api/stream` (SSE), `/api/projects`, `/api/settings` GET/POST, `/api/health` | High | Draft |
| FR-03-02 | `FileWatcher` poll ~200ms; broadcast khi mtime đổi | High | Draft |
| FR-03-03 | `check_alerts`: ngưỡng `cache_hit_rate_min` 0.65 và bash waste scaled (wiki) | Medium | Draft |
| FR-03-04 | Port mặc định 3170, thử N..N+9 nếu busy | Medium | Draft |

**NFR liên quan:** Bind localhost only (wiki security note).
