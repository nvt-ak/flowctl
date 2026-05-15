# API Detail — flowctl

**SRS Reference:** SRS Section 6.2  
**Basic Design:** [api-list.md](api-list.md)

---

## 1. GET `/api/data`

**Operation ID:** `getMonitorApiData`

**Authentication:** TBD — wiki không định nghĩa header auth.

**Response 200 (rút gọn — theo wiki):**  
JSON gồm: step + name từ `load_flow_state()`, totals từ `flatten_stats`, `eff_pct`, `STEP_BUDGETS` (mặc định 12000/step nếu unknown), `bud_pct`, `session_duration`, `daily[date]`, `tools`, `activity` (10 turn), `calls`, `alerts`, `ts`.

**Errors:** **TBD** — wiki không liệt kê mã lỗi HTTP chi tiết ngoài handler swallow connection reset.

---

## 2. GET `/api/stream` (SSE)

**Operation ID:** `streamMonitorSse`

**Behavior:** Subscribe `SSEBroadcaster`; initial `project_update`; ping `: ` mỗi ~25s (wiki).

---

## 3. POST `/api/settings`

**Operation ID:** `postMonitorSettings`

**Request body:** JSON — deep-merge vào `~/.flowctl/config.json`.

**Response:** **TBD** — wiki không dán ví dụ body/response.

---

## 4. Tool `wf_state` (MCP)

**Operation ID:** `wf_state` (MCP)

**Request:** Theo schema MCP trong `shell-proxy.js` — **TBD** bản copy JSON Schema đầy đủ trong tài liệu này (wiki liệt kê tên tool, không dán schema).

**Response:** JSON compact tóm tắt state; `_cache`: `hit`/`miss`.

---

## 5. Tool `flow_advance_step` (MCP)

**Operation ID:** `flow_advance_step`

**Request fields (wiki):** `by` (optional default `'Workflow MCP'`), notes, optional `--skip-gate` mapping.

**Errors:** MCP `isError: true` với body `{ error: ... }` khi handler lỗi.

---

## 6. Validation rules chung

| Kiểu | Rule |
|-------|------|
| JSON body POST settings | Phải parse được JSON — **TBD** giới hạn kích thước |
| Path `wf_read` | Giới hạn dòng + truncation (wiki: line cap) — **TBD số chính xác** |
