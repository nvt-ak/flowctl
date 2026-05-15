## 7. Quality Attributes

### 7.1 Performance

| ID | Requirement | Evidence / ghi chú |
|----|-------------|-------------------|
| NFR-01 | Shell-proxy ưu tiên JSON compact thay transcript lớn | Wiki: token estimate + `BASH_EQUIV` |
| NFR-02 | Monitor watcher poll ~200ms; SSE ping ~25s | Wiki telemetry |
| NFR-03 | P95/P99 latency API production | **TBD** — không áp dụng (localhost dev tool) |

### 7.2 Reliability / Availability

| ID | Requirement | Evidence |
|----|-------------|----------|
| NFR-04 | Idempotency tránh double launch; stale PID cleanup (`STALE_PID_MAX_AGE_SECONDS` default 7200s) | Wiki orchestration |
| NFR-05 | Budget breaker 3-state + cooldown | Wiki budget.sh mô tả |
| NFR-06 | Uptime SLA dịch vụ hosted | **TBD** — không phải dịch vụ hosted |

### 7.3 Security

| ID | Requirement | Evidence |
|----|-------------|----------|
| NFR-07 | Dashboard bind `127.0.0.1`; dữ liệu telemetry nhạy cảm — host tin cậy | Wiki telemetry |
| NFR-08 | AuthN/AuthZ HTTP API | **TBD** — wiki: dev tool, không mô tả JWT/API key cho `/api/*` |
| NFR-09 | Workflow lock giảm race ghi state | Wiki lock.sh |

### 7.4 Scalability

**TBD** — wiki không định lượng số worker đồng thời tối đa ngoài budget caps (policy file).

### 7.5 Maintainability / Observability

- Gate reports dưới `workflows/gates/reports/` (wiki).
- `cmd_team monitor` gợi ý `next_action` (wiki).
