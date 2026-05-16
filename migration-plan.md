# flowctl — Migration Gap Report & Phase Plan
> Rà soát: **2026-05-16** | Phân tích: GitNexus index (4410 symbols, 7649 relationships) + trực tiếp so sánh `scripts/` vs `src/`  
> Mục tiêu: Loại bỏ hoàn toàn phụ thuộc Python/Bash; binary Bun thuần TypeScript.

---

## TÓM TẮT NHANH

| Hạng mục | Số lượng |
|---|---|
| Files Python chưa migrate (production) | **3** (monitor-web.py 1453L, setup.sh 279L, common.sh 119L) |
| JS files còn runtime-canonical | **2** (shell-proxy.js 795L, workflow-state.js 180L — TS port xong nhưng chưa cutover) |
| Module files plan yêu cầu nhưng chưa tạo | **13** files |
| Python inline calls trong flowctl.sh | **44** chỗ |
| Python test files cần port sang Vitest | **14** files |
| TS unit tests hiện có | **54** files |
| Blocker P0 trước cutover | **2** (dispatch/launcher.ts, flowctl.sh MCP routing) |

---

## PHẦN 1 — TRẠNG THÁI MIGRATION THỰC TẾ

### ✅ ĐÃ MIGRATE XONG (shim hoặc full port)

| Script gốc | TS target | Ghi chú |
|---|---|---|
| `scripts/workflow/skills/*.mjs` (6 files) | `src/skills/*.ts` | Shim thuần 7 dòng mỗi file; logic trong TS |
| `scripts/hooks/setup-git-hooks.mjs` | `src/hooks/setup.ts` | Shim → TS Phase 6 |
| `scripts/workflow/lib/context_snapshot.py` (125L) | `src/integrations/context-snapshot.ts` (140L) | Full port ✅ |
| `scripts/workflow/lib/stream_json_capture.py` (93L) | `src/integrations/stream-capture.ts` (100L) | Full port ✅ |
| `scripts/workflow/lib/migrate_legacy_state.py` (56L) | `src/state/migrate.ts` (55L) | Full port ✅ |
| `scripts/merge_cursor_mcp.py` (242L) | `src/integrations/mcp-merge.ts` (275L) | Full port ✅ |
| `scripts/token-audit.py` (522L) | `src/integrations/token-audit.ts` (411L) + `src/commands/audit-tokens.ts` | Full port ✅ |
| `scripts/hooks/log-bash-event.py` (235L) | `src/hooks/log-bash-event.ts` (226L) | Full port ✅ |
| `scripts/hooks/generate-token-report.py` (191L) | `src/hooks/token-report.ts` (327L) | Full port ✅ |
| `scripts/workflow/mcp/shell-proxy.js` (795L) | `src/mcp/shell-proxy/` (1241L TS) | Port XONG — chưa cutover (xem §2) |
| `scripts/workflow/mcp/workflow-state.js` (180L) | `src/mcp/workflow-state.ts` (229L) | Port XONG — chưa cutover (xem §2) |
| `scripts/hooks/invalidate-cache.sh` | `src/hooks/invalidate-cache.ts` (32L) | ✅ |
| `scripts/hooks/prevent-main-commit.sh + push.sh` | `src/hooks/git-guards.ts` (59L) | ✅ |

---

### ⚠️ PORT XONG NHƯNG CHƯA CUTOVER (Runtime vẫn dùng JS)

#### A. MCP servers: `shell-proxy.js` và `workflow-state.js`

**Vấn đề:** `scripts/flowctl.sh` line 321–322 vẫn route `mcp --shell-proxy` → JS file.  
`.cursor/mcp.json` đã dùng `flowctl mcp --shell-proxy` (binary TS) — nhưng flowctl.sh shim (legacy install) vẫn dùng JS.

```bash
# scripts/flowctl.sh:321-322 — CẦN XÓA/THAY:
--shell-proxy)   target="$WORKFLOW_ROOT/scripts/workflow/mcp/shell-proxy.js" ;;
--workflow-state) target="$WORKFLOW_ROOT/scripts/workflow/mcp/workflow-state.js" ;;
```

**Impact range:**
- `src/mcp/cache.ts` (comment: "shell-proxy.js remains canonical at runtime until cutover")
- `.cursor/mcp.json` — đã dùng binary TS → không bị ảnh hưởng nếu dùng `flowctl` binary
- `scripts/flowctl.sh` (legacy shim, user còn cài qua `source flowctl.sh`)
- Test: `test/integration/mcp.test.ts`

**Checklist:**
- [ ] Xóa `scripts/flowctl.sh:321-322` (2 dòng routing → JS)
- [ ] Thêm guard/error message cho users dùng bash shim
- [ ] Chạy `test/integration/mcp.test.ts` — PASS
- [ ] Archive JS files: `scripts/workflow/mcp/deprecated/`
- [ ] Cập nhật comment trong `src/mcp/cache.ts` (xóa "canonical at runtime until cutover")

---

### ❌ CHƯA MIGRATE (Gap thực sự)

#### B. `scripts/monitor-web.py` — HTTP/SSE Dashboard (1453 dòng)

**Trạng thái:** DEFER đến Phase 8+. Bridge hiện tại: `monitor.ts` → `prepareMonitorWebLaunch()` → `execa("python3", ["scripts/monitor-web.py"])`.

**Impact range (callers):**
```
src/cli/index.ts                    ← register `flowctl monitor` command
src/commands/monitor.ts             ← gọi runMonitor()
src/integrations/monitor-web-resolve.ts ← prepareMonitorWebLaunch() + resolveStateFileForRepo()
src/hooks/log-bash-event.ts         ← import resolveStateFileForRepo (không liên quan đến HTTP server)
src/hooks/runner.ts                 ← import resolveStateFileForRepo (không liên quan đến HTTP server)
```

**Phân tách impact:** `monitor-web-resolve.ts` export `resolveStateFileForRepo()` được dùng bởi hooks — phần này đã TS. Chỉ HTTP/SSE server (1453L) mới chưa port.

**Feature gap cần port (Phase 8):**
- [ ] HTTP server layer (`Bun.serve()` thay `BaseHTTPRequestHandler`)
- [ ] SSE broadcaster thread-safe → `ReadableStream` + `controller.enqueue()`
- [ ] Auto-detect projects qua `~/.flowctl/projects/*/meta.json`
- [ ] File watcher polling (2s) → `fs.watch()` hoặc Bun native
- [ ] Dashboard HTML/CSS/JS inline (~500 dòng) — giữ nguyên, chỉ đổi server layer
- [ ] Turn grouping + alert system logic
- [ ] Streaming event log endpoint
- [ ] Xóa bridge `prepareMonitorWebLaunch()` trong `monitor-web-resolve.ts`
- [ ] Cập nhật `src/cli/index.ts` description (xóa mention python)

**Risk:** HIGH — full HTTP server rewrite; phụ thuộc threading model.  
**Ưu tiên:** P3 (sau khi toàn bộ commands hoàn tất).

---

#### C. `scripts/setup.sh` — Init Setup Logic (279 dòng)

**Trạng thái:** `src/commands/init.ts` line 310 vẫn `spawn("bash", [setupScript])`.

```typescript
// src/commands/init.ts:302-322 — BRIDGE CẦN PORT:
const setupScript = join(workflowRoot, "scripts", "setup.sh");
const sh = spawn("bash", [setupScript], { ... });
```

**Checklist (Phase 7.2):**
- [ ] Tạo `src/commands/init/setup.ts` (new file)
- [ ] Port `check_prerequisites` — kiểm tra node/bun/git version
- [ ] Port `install_graphify` / `install_gitnexus` — `npm install -g` qua `process.ts`
- [ ] Port `install_mcp_deps` — `npm install` trong project dir
- [ ] Port `index_codebase` — `npx gitnexus analyze`
- [ ] `configure_cursor_mcp` → gọi `mergeCursorMcp()` đã có TS ✅ (không cần port)
- [ ] Port `update_gitignore` — append entries nếu chưa có
- [ ] Port `start_mcp_servers` — spawn MCP background processes
- [ ] Update `src/commands/init.ts:310` — thay `spawn("bash", setupScript)` bằng `runSetup()`
- [ ] Viết `test/unit/commands/init.test.ts` — cover prerequisites + gitignore update
- [ ] Xóa `scripts/setup.sh` sau khi test PASS

**Impact range:**
```
src/commands/init.ts:302-322      ← spawn("bash", setupScript) — CẦN ĐỔI
src/cli/index.ts                  ← register `flowctl init`
```

**Target:** `src/commands/init/setup.ts` (new file)  
**Risk:** MEDIUM — mostly process spawn + file manipulation; không có state machine phức tạp.

---

#### D. `scripts/workflow/lib/common.sh` — wf_mcp_health_check (119 dòng)

**Trạng thái:** Không có file TS nào. Được gọi bởi `cmd_start` (flowctl.sh:823) và `cursor_dispatch.sh`. Khi FLOWCTL_ENGINE=ts, commands này chạy TS nhưng không chạy health check.

**Gap cụ thể:** `wf_mcp_health_check()` (61 dòng) — kiểm tra MCP server PID còn sống, ping tools, log kết quả.

**Impact range:**
```
src/commands/start.ts             ← KHÔNG gọi health check (gap)
src/commands/cursor-dispatch/index.ts ← KHÔNG gọi health check (gap)
src/utils/mcp-health.ts           ← TỒN TẠI — có thể đã có partial port? (cần kiểm tra)
```

**Checklist (Phase 7.3):**
- [ ] Đọc `src/utils/mcp-health.ts` — audit xem đã có `checkMcpHealth()` chưa
- [ ] Port `wf_mcp_health_check()` (61 dòng) từ `common.sh` nếu chưa đủ
- [ ] Gọi `checkMcpHealth()` từ `src/commands/start.ts` (đầu flow)
- [ ] Gọi `checkMcpHealth()` từ `src/commands/cursor-dispatch/index.ts`
- [ ] Viết test cover: MCP alive → pass, MCP dead → warning (không block)

**Target:** `src/utils/mcp-health.ts` (kiểm tra lại — file tồn tại, cần xem đầy đủ chưa)  
**Risk:** LOW-MEDIUM — health check không blocking logic chính.

---

#### E. Dispatch Worker Spawn — Bash Delegate (Blocker P0)

**Trạng thái:** `src/commands/dispatch/index.ts:157` vẫn delegate worker spawn về bash:

```typescript
// src/commands/dispatch/index.ts:157 — CẦN THAY:
`worker launch via bash: FLOWCTL_ENGINE= bash flowctl dispatch --${mode} --role ${role}`
```

**Đây là blocker trước Phase 8 cutover.** Khi chạy `FLOWCTL_ENGINE=ts`, dispatch chạy TS nhưng worker spawn lại gọi bash (recursive). File `src/commands/dispatch/launcher.ts` chưa tồn tại.

**Impact range:**
```
src/commands/dispatch/index.ts    ← gọi bash spawn (dòng 157)
src/commands/team/index.ts        ← import runDispatch (9 lines)
src/commands/cursor-dispatch/index.ts ← import runDispatch
src/commands/brainstorm.ts        ← import DispatchOptions type
src/cli/index.ts                  ← register dispatch + cursor-dispatch commands
```

**Checklist (Phase 7.1):**
- [ ] Tạo `src/utils/process.ts` — spawn/exec wrapper với timeout + PID capture
- [ ] Tạo `src/commands/dispatch/launcher.ts` — worker process spawn, lưu PID vào state
- [ ] Port Cursor board spawn từ `cursor_dispatch.sh` → `src/commands/cursor-dispatch/board.ts`
- [ ] Update `dispatch/index.ts:157` — thay bash delegate string bằng `launchWorker()`
- [ ] Đảm bảo idempotency: nếu PID còn sống → skip relaunch (đã có trong `utils/lock.ts`)
- [ ] Update `test/unit/dispatch/idempotency.test.ts` — mock spawn, verify PID tracking
- [ ] Smoke test: `flowctl dispatch --headless` không còn log "via bash"

**Target:** `src/commands/dispatch/launcher.ts` (new) — process spawn thuần TS  
**Risk:** HIGH — concurrency, PID tracking, Cursor board spawn.

---

#### F. 44 Inline `python3` Calls trong `flowctl.sh`

**Trạng thái:** `flowctl.sh` có 44 chỗ gọi `python3 -c "..."` hoặc `python3 - <<'PY'` để đọc/ghi JSON state, increment counters, v.v.

**Phân loại:**
- **JSON read/write inline** (30+ chỗ): `python3 -c "import json; print(json.load(...)...)"` → khi FLOWCTL_ENGINE=ts, các commands đã TS không còn đi qua flowctl.sh nên đây không còn là blocking issue.
- **Flow bootstrap** (`_bootstrap_init_flow`): Python heredoc tạo state.json → đã được port qua `init.ts` TS logic.
- **Flow switch/list**: Python parse flows.json → có trong `src/commands/flow/`.
- **Legacy shim paths**: Khi đa số commands đã chạy TS, flowctl.sh chỉ còn là fallback.

**Risk:** LOW — chỉ ảnh hưởng users dùng legacy bash shim, không ảnh hưởng TS binary.

---

## PHẦN 2 — MODULE FILES MISSING (Plan yêu cầu, chưa tạo)

| File | Mô tả | Priority | Blocker cho |
|---|---|---|---|
| `src/utils/logger.ts` | chalk wrapper (wf_info/warn/error/success) | P1 | Cleanup trước cutover |
| `src/utils/process.ts` | subprocess helpers (spawn, exec wrapper) | P1 | dispatch/launcher.ts |
| `src/utils/platform.ts` | OS detection, path normalize | P2 | Cross-platform binary |
| `src/config/settings.ts` | global `~/.flowctl/config.json` | P2 | status --all, monitor |
| `src/types/` barrel (4 files) | Explicit type exports từ Zod | P3 | Không blocking |
| `src/commands/dispatch/launcher.ts` | Worker process spawn | **P0** | Phase 8 cutover |
| `src/commands/dispatch/idempotency.ts` | Tách từ `utils/lock.ts` | P3 | Không blocking (đã có) |
| `src/commands/init/setup.ts` | Port `setup.sh` | P1 | `flowctl init` thuần TS |
| `src/commands/team/` subcommands (8 files) | Split monolithic `team/index.ts` (233L) | P2 | Maintainability |

**Checklist — P0:**
- [ ] Tạo `src/commands/dispatch/launcher.ts` (Phase 7.1)
- [ ] Tạo `src/utils/process.ts` (Phase 7.1, prerequisite của launcher)

**Checklist — P1:**
- [ ] Tạo `src/utils/logger.ts` — chalk wrapper thống nhất (`wf_info`, `wf_warn`, `wf_error`, `wf_success`)
- [ ] Tạo `src/commands/init/setup.ts` — port `setup.sh` (Phase 7.2)
- [ ] Tạo `src/config/settings.ts` — global `~/.flowctl/config.json` (Phase 7.2)

**Checklist — P2:**
- [ ] Tạo `src/utils/platform.ts` — OS detection (`isMac`, `isWindows`), path normalize
- [ ] Quyết định split `src/commands/team/index.ts` (233L) — hiện chấp nhận monolithic

**Checklist — P3 (defer):**
- [ ] Tạo `src/types/state.ts`, `policy.ts`, `budget.ts`, `mcp.ts` — explicit type barrels
- [ ] Tạo `src/commands/dispatch/idempotency.ts` — tách từ `utils/lock.ts` nếu cần

---

## PHẦN 3 — PYTHON TEST FILES CẦN PORT SANG VITEST

14 Python test files trong `tests/` cần được port hoặc thay thế trước khi drop Python dependency:

| File | Lines | Ưu tiên | TS equivalent hiện có? |
|---|---|---|---|
| `tests/test_fork_isolation.py` | 486 | P1 | Không |
| `tests/test_init_safety.py` | 396 | P1 | `test/unit/commands/init.test.ts` (partial) |
| `tests/test_plan_fixes.py` | 323 | P1 | `test/unit/commands/plan.test.ts` (partial) |
| `tests/test_concurrency.py` | 234 | **P0** | `test/unit/state/writer.test.ts` (partial) |
| `tests/test_mcp_cache.py` | 237 | **P0** | `test/unit/mcp/cache.test.ts` ✅ (có thể đủ) |
| `tests/test_mercenary.py` | 248 | P2 | `test/unit/commands/mercenary.test.ts` ✅ |
| `tests/test_budget_breaker.py` | 235 | P1 | `test/unit/budget/breaker.test.ts` ✅ |
| `tests/test_evidence.py` | 201 | P1 | `test/unit/integrations/evidence.test.ts` ✅ |
| `tests/test_plan_priority3.py` | 190 | P2 | Không |
| `tests/test_monitor_web_resilience.py` | 158 | P3 | Không (monitor DEFER) |
| `tests/test_dispatch_policy.py` | 157 | P1 | `test/unit/commands/dispatch/policy.test.ts` ✅ |
| `tests/test_plan_priority2.py` | 144 | P2 | Không |
| `tests/test_error_recovery.py` | 134 | P2 | Không |
| `tests/test_stream_capture.py` | 89 | P1 | `test/unit/integrations/stream-capture.test.ts` ✅ |

**Checklist — P0 (bắt buộc trước cutover):**
- [ ] `test_concurrency.py` — extend `test/unit/state/writer.test.ts` với atomic write + concurrent access tests
- [ ] `test_mcp_cache.py` — audit `test/unit/mcp/cache.test.ts`, bổ sung cases còn thiếu

**Checklist — P1:**
- [ ] `test_fork_isolation.py` — tạo `test/unit/commands/fork.test.ts` (486L, file lớn nhất)
- [ ] `test_init_safety.py` — extend `test/unit/commands/init.test.ts` với safety edge cases
- [ ] `test_plan_fixes.py` — extend `test/unit/commands/plan.test.ts` với regression cases
- [ ] `test_budget_breaker.py` — audit `test/unit/budget/breaker.test.ts`, bổ sung nếu thiếu
- [ ] `test_evidence.py` — audit `test/unit/integrations/evidence.test.ts`, bổ sung nếu thiếu
- [ ] `test_dispatch_policy.py` — audit `test/unit/commands/dispatch/policy.test.ts`
- [ ] `test_stream_capture.py` — audit `test/unit/integrations/stream-capture.test.ts`

**Checklist — P2:**
- [ ] `test_plan_priority2.py` — tạo test TS tương ứng
- [ ] `test_plan_priority3.py` — tạo test TS tương ứng
- [ ] `test_error_recovery.py` — tạo `test/unit/state/recovery.test.ts`
- [ ] `test_mercenary.py` — audit `test/unit/commands/mercenary.test.ts`

**Checklist — P3 (sau Phase 8):**
- [ ] `test_monitor_web_resilience.py` — tạo sau khi `monitor-web.py` port xong

**Checklist — Cleanup sau khi hoàn tất P0+P1:**
- [ ] Xóa `npm run test:python` khỏi `package.json`
- [ ] Xóa thư mục `tests/` (Python)
- [ ] Xóa `pytest.ini`
- [ ] Xóa `tests/conftest.py` và `tests/helpers/`

---

## PHẦN 4 — PHASE PLAN (CẬP NHẬT)

> Các Phase 0–6 đã được mô tả trong `.cursor/plans/migration-plan.md` v2.1. File này chỉ ghi lại **delta — những gì còn thiếu**.

### Phase 7 — MCP Cutover (JS → TS Runtime)
**Estimate:** 1–2 ngày  
**DoD:** `flowctl mcp --shell-proxy` và `--workflow-state` dùng TS runtime, không cần `shell-proxy.js` / `workflow-state.js`.

**Checklist:**
- [ ] Xóa `scripts/flowctl.sh:321-322` (2 dòng `target=...shell-proxy.js` và `target=...workflow-state.js`)
- [ ] Đảm bảo binary `flowctl` (Bun compile) là entrypoint duy nhất cho MCP
- [ ] Chạy `bun run test:integration` — PASS
- [ ] Chạy `test/integration/mcp.test.ts` riêng — PASS
- [ ] Archive JS files: `git mv scripts/workflow/mcp/{shell-proxy,workflow-state}.js scripts/workflow/mcp/deprecated/`
- [ ] Cập nhật `src/mcp/cache.ts` comment (xóa "canonical at runtime until cutover")
- [ ] Verify `.cursor/mcp.json` không thay đổi (đã dùng binary)

**Blast radius:** LOW — chỉ ảnh hưởng legacy bash shim users; `.cursor/mcp.json` đã dùng binary.

---

### Phase 7.1 — `dispatch/launcher.ts` (P0 Blocker)
**Estimate:** 3–5 ngày  
**DoD:** Worker spawn không còn delegate về bash; toàn bộ dispatch flow chạy TS.

**Checklist:**
- [ ] Tạo `src/utils/process.ts` — spawn/exec wrapper với timeout + PID capture
- [ ] Tạo `src/commands/dispatch/launcher.ts` — worker process spawn, lưu PID vào state
- [ ] Port Cursor board spawn từ `cursor_dispatch.sh` → `src/commands/cursor-dispatch/board.ts`
- [ ] Update `dispatch/index.ts:157` — thay bash delegate string bằng `launchWorker()`
- [ ] Idempotency: nếu PID còn sống → skip (verify dùng `utils/lock.ts`)
- [ ] Update `test/unit/dispatch/idempotency.test.ts` — mock spawn, verify PID tracking
- [ ] Smoke test: `flowctl dispatch --headless` không còn log "via bash"
- [ ] Chạy `bun run test:unit` — PASS

**Blast radius:** HIGH
```
src/commands/dispatch/index.ts       ← thay bash spawn
src/commands/team/index.ts           ← đi qua runDispatch
src/commands/cursor-dispatch/index.ts ← đi qua runDispatch
src/cli/index.ts                     ← register
test/unit/dispatch/idempotency.test.ts ← cần update
```

---

### Phase 7.2 — `init.ts` setup.sh elimination
**Estimate:** 2–3 ngày  
**DoD:** `flowctl init` không còn gọi `spawn("bash", [setupScript])`.

**Checklist:**
- [ ] Tạo `src/commands/init/setup.ts` — port `scripts/setup.sh`
- [ ] Port `check_prerequisites` — node/bun/git version validation
- [ ] Port `install_graphify` / `install_gitnexus` — dùng `src/utils/process.ts`
- [ ] Port `install_mcp_deps` — `npm install` trong project dir
- [ ] Port `index_codebase` — `npx gitnexus analyze`
- [ ] Port `update_gitignore` — append entries nếu chưa có
- [ ] Port `start_mcp_servers` — spawn MCP background processes
- [ ] Tạo `src/config/settings.ts` — global `~/.flowctl/config.json` reader
- [ ] Update `src/commands/init.ts:310` — thay `spawn("bash", setupScript)` bằng `runSetup()`
- [ ] Extend `test/unit/commands/init.test.ts` — cover setup sections
- [ ] Chạy `bun run test:unit` — PASS
- [ ] Xóa `scripts/setup.sh` sau khi smoke test PASS

**Blast radius:** MEDIUM
```
src/commands/init.ts:302-322   ← thay spawn bash
src/cli/index.ts               ← register init
test/unit/commands/init.test.ts ← cần test coverage mới
```

---

### Phase 7.3 — `wf_mcp_health_check` gap
**Estimate:** 1 ngày  
**DoD:** `start` và `cursor-dispatch` có health check equivalent trong TS.

**Checklist:**
- [ ] Đọc `src/utils/mcp-health.ts` — audit xem đã có `checkMcpHealth()` / `warnIfMcpDown()` chưa
- [ ] Port `wf_mcp_health_check()` (61 dòng) từ `common.sh` vào `mcp-health.ts` nếu thiếu
- [ ] Gọi health check từ `src/commands/start.ts` (đầu flow, non-blocking nếu fail)
- [ ] Gọi health check từ `src/commands/cursor-dispatch/index.ts`
- [ ] Viết test: MCP alive → log info, MCP dead → log warning (không throw)
- [ ] Chạy `bun run test:unit` — PASS

**Blast radius:** LOW
```
src/commands/start.ts                ← thêm health check call
src/commands/cursor-dispatch/index.ts ← thêm health check call
src/utils/mcp-health.ts              ← extend/create
```

---

### Phase 7.4 — Port Python tests → Vitest
**Estimate:** 5–7 ngày  
**DoD:** `npm run test:python` có thể bị xóa; toàn bộ coverage trong Vitest.

**Checklist — P0 (phải xong trước cutover):**
- [ ] `test_concurrency.py` → extend `test/unit/state/writer.test.ts` (concurrency + atomic write)
- [ ] `test_mcp_cache.py` → audit `test/unit/mcp/cache.test.ts` — đủ coverage chưa?

**Checklist — P1:**
- [ ] `test_fork_isolation.py` → tạo `test/unit/commands/fork.test.ts`
- [ ] `test_init_safety.py` → extend `test/unit/commands/init.test.ts`
- [ ] `test_plan_fixes.py` → extend `test/unit/commands/plan.test.ts`
- [ ] `test_budget_breaker.py` → audit `test/unit/budget/breaker.test.ts` — đủ chưa?
- [ ] `test_evidence.py` → audit `test/unit/integrations/evidence.test.ts` — đủ chưa?
- [ ] `test_dispatch_policy.py` → audit `test/unit/commands/dispatch/policy.test.ts` — đủ chưa?
- [ ] `test_stream_capture.py` → audit `test/unit/integrations/stream-capture.test.ts` — đủ chưa?

**Checklist — P2:**
- [ ] `test_plan_priority2.py` → tạo test TS tương ứng
- [ ] `test_plan_priority3.py` → tạo test TS tương ứng
- [ ] `test_error_recovery.py` → tạo `test/unit/state/recovery.test.ts`
- [ ] `test_mercenary.py` → audit `test/unit/commands/mercenary.test.ts`

**Checklist — P3 (sau Phase 8):**
- [ ] `test_monitor_web_resilience.py` → tạo sau khi `monitor-web.py` port xong

**Checklist — Hoàn tất:**
- [ ] Xóa `npm run test:python` khỏi `package.json` sau khi tất cả P0+P1 PASS
- [ ] Xóa thư mục `tests/` (Python) sau khi migration confirm
- [ ] Xóa `pytest.ini` và `tests/conftest.py`

---

### Phase 8 — monitor-web.py Full Port (DEFER)
**Estimate:** 7–10 ngày  
**DoD:** `flowctl monitor` không còn cần Python; pure Bun HTTP + SSE.

**Checklist — Thiết kế:**
- [ ] Thiết kế API routes: `/api/data`, `/events` (SSE), `/` (dashboard HTML)
- [ ] Quyết định port mặc định (hiện Python dùng 3170)

**Checklist — Implementation:**
- [ ] Tạo `src/commands/monitor/server.ts` — `Bun.serve()` HTTP + SSE handler
- [ ] Port `SSEBroadcaster` (thread-safe) → async generator + `ReadableStream`
- [ ] Port `FileWatcher` (polling 2s) → `setInterval` + `fs.stat` mtime tracking
- [ ] Port `build_api_data()` → `buildDashboardData()` in TypeScript
- [ ] Port `load_stats()`, `load_events()`, `load_flow_state()` → TS readers
- [ ] Port `group_into_turns()`, `compute_turn_summary()`, `check_alerts()` → TS
- [ ] Port `discover_projects()` → scan `~/.flowctl/projects/*/meta.json`
- [ ] Copy HTML/CSS/JS dashboard inline từ Python (không cần rewrite)
- [ ] Update `src/commands/monitor.ts` — thay `execa("python3", ...)` bằng `startMonitorServer()`
- [ ] Xóa `prepareMonitorWebLaunch()` và `MonitorLaunchPlan` khỏi `monitor-web-resolve.ts`
- [ ] Giữ `resolveStateFileForRepo()` trong `monitor-web-resolve.ts` (vẫn dùng bởi hooks)
- [ ] Cập nhật `src/cli/index.ts` description (xóa "python scripts/monitor-web.py")
- [ ] Viết `test/unit/commands/monitor/server.test.ts` — mock fs, test SSE stream
- [ ] Chạy `bun run test:unit` — PASS
- [ ] E2E: `flowctl monitor --once` trả về JSON hợp lệ
- [ ] Xóa `scripts/monitor-web.py` sau khi smoke test PASS
- [ ] Xóa `scripts/lib/state_resolver.py` (không còn Python caller nào)

**Blast radius:** MEDIUM (isolated trong monitor module)
```
src/commands/monitor.ts              ← đổi execa python → Bun.serve()
src/integrations/monitor-web-resolve.ts ← xóa prepareMonitorWebLaunch
src/cli/index.ts                     ← update description
```

---

## PHẦN 5 — INCONSISTENCIES CẦN QUYẾT ĐỊNH

| Vấn đề | Hiện trạng | Quyết định đề xuất |
|---|---|---|
| `src/commands/team/` — monolithic | 233L trong `index.ts`, không split như plan | **Chấp nhận** — split khi > 400L hoặc có subcommand mới |
| `dispatch/idempotency.ts` | Logic nằm trong `utils/lock.ts` | **Chấp nhận** — không move |
| `src/utils/logger.ts` | Chưa tạo; chalk dùng trực tiếp | **Tạo trong Phase 7.4** — cần nhất quán trước cutover |
| `src/types/` barrel | Chưa tạo | **Defer** — infer từ Zod đủ dùng |
| `src/config/settings.ts` | Chưa tạo | **Tạo trong Phase 7.2** (cùng với init setup port) |

---

## PHẦN 6 — CUTOVER CHECKLIST (Trước khi xóa scripts/)

```
[ ] Phase 7: flowctl.sh không còn route MCP → JS files
[ ] Phase 7.1: dispatch/launcher.ts — zero bash delegate
[ ] Phase 7.2: init.ts không còn spawn("bash", setupScript)
[ ] Phase 7.3: mcp-health.ts đầy đủ, được gọi từ start + cursor-dispatch
[ ] Phase 7.4: test:python pass 100% qua Vitest (hoặc có quyết định skip)
[ ] Binary `dist/flowctl` build thành công (bun build)
[ ] test:integration PASS với binary
[ ] scripts/flowctl.sh chỉ còn legacy install shim, document rõ ràng
[ ] scripts/monitor-web.py còn lại (DEFER Phase 8) — document trong tech-debt.md
[ ] scripts/lib/state_resolver.py xóa khi log-bash-event.py + monitor-web.py đã port
```

---

## PHỤ LỤC — FILE SIZE REFERENCE

### Python scripts còn tồn tại (production):
| File | Lines | Status |
|---|---|---|
| `scripts/monitor-web.py` | 1453 | DEFER Phase 8 |
| `scripts/setup.sh` | ~279 | Phase 7.2 |
| `scripts/workflow/lib/common.sh` | 119 | Phase 7.3 (partial) |
| `scripts/lib/state_resolver.py` | 43 | Drop khi monitor + hooks đã port |

### JS files còn runtime-canonical:
| File | Lines | Status |
|---|---|---|
| `scripts/workflow/mcp/shell-proxy.js` | 795 | Port xong → Phase 7 cutover |
| `scripts/workflow/mcp/workflow-state.js` | 180 | Port xong → Phase 7 cutover |

### TS port tương ứng đã có:
| Module | Lines | Coverage |
|---|---|---|
| `src/mcp/shell-proxy/` (8 files) | 1241 | ✅ Full port |
| `src/mcp/workflow-state.ts` | 229 | ✅ Full port |
