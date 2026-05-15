## F-04 Token usage auditing

### F-04.1 Description

**Feature Name:** `scripts/token-audit.py`

**Priority:** Medium

**Brief Description:**  
CLI độc lập tổng hợp JSONL MCP: overhead vs work (`OVERHEAD_TOOLS`), format báo cáo đa dạng, đọc graphify health — wiki **Token usage auditing**.

**Related Use Cases:** UC-05

---

### F-04.3 Functional Requirements

| Req ID | Requirement Description | Priority | Status |
|--------|---------------------------|----------|--------|
| FR-04-01 | Đọc các field event: `tool`, `output_tokens`, `saved_tokens`, `cache`, `ts`, `step`, keys nhóm task như wiki | High | Draft |
| FR-04-02 | JSON dòng lỗi skip silently trong `load_events()` | Medium | Draft |
| FR-04-03 | `graphify_status()` đọc `<repo>/.graphify/graph.json` (wiki; **đường dẫn có thể khác graphify-out trong rule repo** — TBD đồng bộ với cấu hình Graphify thực tế nếu hai nguồn tồn tại) | Low | Draft |
