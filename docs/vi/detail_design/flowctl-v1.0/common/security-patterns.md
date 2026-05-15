# Security Patterns — flowctl

**SRS Reference:** Section 7.3

---

## 1. Authentication & authorization

- **MCP HTTP:** không có — MCP là stdio local.
- **Monitor HTTP:** bind `127.0.0.1`; không auth trong wiki → **TBD** nếu team bổ sung Basic Auth.

## 2. State mutation boundary

- Mutations workflow qua `flowctl` (CLI hoặc MCP `flow_*`) — wiki workflow-state.

## 3. Sensitive data

- Telemetry có thể chứa prefix bash — wiki: truncate UI, host tin cậy.
- **TBD** — policy mask PII trong `events.jsonl`.

## 4. Encryption

**TBD** — wiki không mô tả encryption at rest cho state file.

## 5. Input validation

- `flow_add_blocker` yêu cầu `description` (wiki).
- **TBD** — validation độ dài/ký tự đầy đủ cho mọi tool MCP.
