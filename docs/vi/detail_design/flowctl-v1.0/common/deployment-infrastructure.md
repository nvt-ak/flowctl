# Deployment & Infrastructure — flowctl

**SRS Reference:** Section 9

---

## 1. Environments

| Env | Mô tả |
|-----|--------|
| Local dev | Mặc định wiki |
| CI | Scripts `test:ci` được nhắc trong overview — **TBD** chi tiết pipeline |

## 2. Config / env vars

Tiêu biểu: `FLOWCTL_PROJECT_ROOT`, `FLOWCTL_CACHE_DIR`, `FLOWCTL_EVENTS_F`, `FLOWCTL_STATS_F`, `WF_WAR_ROOM_THRESHOLD` (wiki).

## 3. Feature flags

**TBD** — wiki không dùng thuật ngữ feature flag; có `FLOWCTL_SKIP_SETUP`, policy `enabled: false` cho budget.

## 4. Rollback

- `team recover --mode rollback` xóa report+log và đánh dấu idempotency (wiki).

## 5. Packaging

- `npm pack` / release scripts: **TBD** chi tiết từ `package.json`.
