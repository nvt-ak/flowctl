# Error Handling Patterns — flowctl

**SRS Reference:** Section 4 F-01

---

## 1. CLI exit codes (dispatch)

| HTTP analog | Code | Meaning |
|-------------|------|---------|
| — | 0 | Success |
| 400-class | 1 | Logical / I/O / JSON / missing agents |
| 403-class | 2 | `POLICY_VIOLATION` |
| — | 255 | Unexpected Python failure |

## 2. MCP errors

- `isError: true` + JSON `{ error: ... }` (wiki workflow-state).

## 3. Gate / evidence

- `GATE_OK` / `GATE_FAIL` messages — wiki gate.sh (chi tiết string: **TBD** trích source).

## 4. Merge MCP invalid JSON

- Exit 2, stderr tiếng Việt (wiki).
