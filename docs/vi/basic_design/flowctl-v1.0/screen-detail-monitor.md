# Screen Detail — Dashboard telemetry (SCR-01)

**SRS Reference:** SRS Section 4 — F-03  
**Screen ID:** SCR-01

---

## 1. Overview

| Thuộc tính | Giá trị |
|------------|---------|
| Purpose | Quan sát token, cache hit, workflow step, blockers từ file local |
| User Role | Developer |
| Entry | `flowctl monitor` hoặc `python3 scripts/monitor-web.py` |

---

## 2. Visual Wireframe (khối chức năng — theo wiki)

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: project / step / budget bar                     │
├─────────────────────────────────────────────────────────┤
│ STATS: consumed vs saved tokens, efficiency %           │
├───────────────────────┬─────────────────────────────────┤
│ TOOLS TABLE           │  ACTIVITY / CALLS               │
│ (calls desc)          │  (last turns / MCP calls)       │
├───────────────────────┴─────────────────────────────────┤
│ ALERTS (cache hit / bash waste heuristics)              │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Layout Structure

| Component | Position | Mô tả |
|-----------|----------|--------|
| Header | Top | Step name, `bud_pct`, blockers count (từ `build_api_data`) |
| Stats cards | Upper | `flatten_stats`, efficiency |
| Tools / Calls | Main columns | Wiki: sorted tools, `build_calls_log` |
| Alerts | Footer | `check_alerts` thresholds |

---

## 4. States

| State | Hành vi (wiki) |
|-------|----------------|
| Loading ban đầu | `fetch('/api/data')` rồi `render(d)` |
| Live | SSE `project_update` merge vào cache client |
| Pause | Chỉ client — server vẫn broadcast |
| Error project | `build_project_data` có thể trả `error` field |

---

## 5. User Flows

1. User chạy `flowctl monitor` → browser mở (tuỳ config `monitor.auto_open_browser`).
2. UI load `/api/data` → hiển thị project hiện tại.
3. `connectSSE` nhận cập nhật khi file watcher phát hiện thay đổi.
