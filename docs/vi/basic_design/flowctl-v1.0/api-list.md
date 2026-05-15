# API List — flowctl (Monitor HTTP + MCP)

**SRS Reference:** SRS Section 4 — F-02, F-03; Section 6.2

---

## 1. API Overview

| Khối | Base | Protocol | Auth |
|------|------|----------|------|
| Monitor web | `http://127.0.0.1:<port>` (mặc định từ 3170) | HTTP/JSON/SSE | **TBD** — wiki: dev tool, không mô tả auth |
| MCP servers | (stdio, không URL HTTP) | MCP JSON-RPC qua SDK | Theo Cursor / MCP host |

**Content type:** `application/json` cho API monitor.

---

## 2. Authentication

**Monitor:** **TBD** — wiki nêu bind localhost và tin cậy host; không có JWT/API key trong tài liệu wiki.

**MCP:** Xác thực theo cơ chế Cursor spawn process — **TBD** chi tiết bảo mật credential nếu có.

---

## 3. Endpoint Summary — Monitor (`MonitorHandler`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | HTML SPA inline | TBD |
| GET | `/api/data` | `build_api_data()` JSON | TBD |
| GET | `/api/stream` | SSE stream | TBD |
| GET | `/api/projects` | Multi-project | TBD |
| GET | `/api/settings` | Đọc `~/.flowctl/config.json` | TBD |
| POST | `/api/settings` | Deep-merge JSON settings | TBD |
| GET | `/api/health` | `{"ok":true}` | TBD |

Chi tiết request/response: [api-detail.md](api-detail.md)

---

## 4. MCP Tools Summary (`shell-proxy`)

| Tool name | Mô tả ngắn | Cache strategy (wiki) |
|-----------|------------|------------------------|
| `wf_state` | Tóm tắt `flowctl-state.json` | `state` |
| `wf_git` | rev-parse, log, status | `git` + TTL status |
| `wf_step_context` | Rich step context | `state` |
| `wf_files` | Listing có filter | `ttl` 120s |
| `wf_read` | Đọc file + optional compress | `mtime` |
| `wf_env` | node/npm/python/git/uname | `static` |
| `wf_reports_status` | So khớp report vs agents | `ttl` 30s |
| `wf_set_agent` | Gắn agent cho logging | (no withLogging) |
| `wf_cache_stats` | Thống kê cache | — |
| `wf_cache_invalidate` | Invalidate scope | (no withLogging) |

---

## 5. MCP Tools Summary (`workflow-state`)

| Tool name | Mô tả |
|-----------|--------|
| `flow_get_state` | Đọc JSON state |
| `flow_add_blocker` | `flowctl blocker add` |
| `flow_add_decision` | `flowctl decision` |
| `flow_advance_step` | `flowctl approve` (+ optional skip-gate) |
| `flow_request_approval` | `flowctl decision` với prefix approval |

---

## 6. Pagination / Filtering

**TBD** cho HTTP monitor — wiki không mô tả phân trang REST chuẩn.  
MCP `wf_files` có `depth`/`pattern` — xem api-detail.

---

## 7. OpenAPI

**TBD** — chưa có file OpenAPI trong wiki; có thể sinh từ source Python sau.
