## 5. Data Requirements

### 5.1 Logical Data Entities (file-based / runtime)

Các thực thể sau được wiki mô tả như **artifact trên đĩa** hoặc runtime — không phải schema SQL quan hệ.

| Entity / File | Purpose (trích wiki) | Retention / lifecycle |
|-----------------|----------------------|------------------------|
| `flowctl-state.json` | Snapshot workflow: bước, blockers, decisions, deliverables, dispatch_risk, metrics | Team-shared; version control tùy team |
| `budget-state.json` | Breaker state, roles, run counters | Runtime dưới `FLOWCTL_RUNTIME_DIR` |
| `budget-events.jsonl` | Append-only budget events | Audit |
| `idempotency.json` | Trạng thái launch headless theo key | Per dispatch run |
| `session-stats.json` | Tổng hợp token/cost/cache MCP | Cache dir |
| `events.jsonl` | Log sự kiện MCP tool | Cache dir |
| `_gen.json` | Generation counters cho cache invalidation | Cache dir |
| `~/.flowctl/registry.json` | Heartbeat project | Global |
| `~/.flowctl/projects/<id>/meta.json` | Multi-project monitor | Global |
| Evidence manifests `step-*-manifest.json` | SHA-256 reports/logs | `EVIDENCE_DIR` |

### 5.2 Data dictionary chi tiết (field-level)

**TBD** — wiki mô tả hành vi và tên file, không cung cấp dictionary đầy đủ từng field JSON. Cần trích xuất từ template `templates/flowctl-state.template.json` và source Python nhúng nếu cần SRS chi tiết hơn.

### 5.3 Migration / versioning

**TBD** — wiki không mô tả chiến lược migration state giữa phiên bản flowctl.
