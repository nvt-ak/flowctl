## 6. External Interfaces

### 6.1 User Interfaces

- **CLI (`flowctl`)** — stdout/stderr, mã thoát theo submodule (ví dụ dispatch wiki).
- **Markdown brief / report** — `workflows/dispatch/step-N/*-brief.md`, `*-report.md`.
- **Dashboard web** — HTML nhúng trong `monitor-web.py`, không static asset dir riêng (wiki).

### 6.2 Software Interfaces

| Interface | Protocol | Mô tả (wiki) |
|-----------|----------|----------------|
| MCP `shell-proxy` | stdio MCP | Tools `wf_*`, cache, logging token |
| MCP `workflow-state` | stdio MCP | Tools `flow_*` → `flowctl` |
| Monitor HTTP | HTTP/JSON/SSE localhost | `/api/*` như wiki |
| `flowctl` subprocess | argv / cwd | `workflow-state.js` gọi `execFileSync` |
| Git | CLI | `wf_git`, hooks |

### 6.3 Hardware Interfaces

**TBD** — không có trong wiki.

### 6.4 Communication Interfaces

- **SSE:** `/api/stream`, ping ~25s (wiki).
- **Registry lock:** exclusive file lock `registry.json.lock` với backoff (wiki MCP).
