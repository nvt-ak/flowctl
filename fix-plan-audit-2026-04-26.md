# Fix Plan — Flowctl Audit 2026-04-26

> Dựa trên Flowctl Comprehensive Audit Report (April 26, 2026)
> Tổng: 5 Critical/High · 7 Medium · 8 Low · 12 Test Gaps

---

## Phase 1 — Critical/High (Fix trước release tiếp theo)

### F-01 · Race Condition in Idempotency Lock
**File:** `scripts/workflow/lib/dispatch.sh` (lines 365–399)  
**Severity:** HIGH  
**Risk:** Parallel headless processes đều LAUNCH → duplicate work, PID bị overwrite

**Fix:**
Wrap toàn bộ read-check-write cycle trong idempotency Python block bằng `fcntl.LOCK_EX`:
```python
with open(IDEMPOTENCY_FILE, 'r+') as f:
    fcntl.flock(f, fcntl.LOCK_EX)  # Acquire exclusive lock FIRST
    data = json.load(f)
    # ... check status ...
    # ... write new state ...
    # lock auto-released on context exit
```
Đảm bảo write tại lines 420–452 nằm trong cùng lock scope, không re-read sau khi lock đã mở.

---

### F-02 · JSON Lock Not Honored in state.sh
**File:** `scripts/workflow/lib/state.sh` (lines 15–46)  
**Severity:** HIGH  
**Risk:** State file bị corrupt khi high contention

**Fix:**
Sau `fcntl.flock()`, kiểm tra return value. Thêm retry với exponential backoff:
```python
import time, random

MAX_RETRIES = 5
for attempt in range(MAX_RETRIES):
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        break
    except BlockingIOError:
        if attempt == MAX_RETRIES - 1:
            raise RuntimeError("Could not acquire state lock after retries")
        time.sleep(0.1 * (2 ** attempt) + random.uniform(0, 0.05))
```

---

### F-03 · Budget State Mutations Under Concurrency
**File:** `scripts/workflow/lib/budget.sh` (lines 364–369)  
**Severity:** HIGH  
**Risk:** Token cap bị bypass khi parallel workers đều pass prelaunch check

**Fix:**
Bọc toàn bộ `wf_budget_prelaunch_check()` Python block trong `fcntl.LOCK_EX` trên `BUDGET_STATE_FILE`. Pattern tương tự F-02. Critical: lock phải giữ suốt cả đọc → tính toán → ghi.

---

### F-04 · Silent Failure in shell-proxy.js MCP Tool Calls
**File:** `scripts/workflow/mcp/shell-proxy.js` (lines 171–172)  
**Severity:** CRITICAL  
**Risk:** Errors bị swallow hoàn toàn, client không biết message có vào queue không

**Fix:**
```javascript
// Trước (bare except):
for (const q of clients) {
    try { q.put_nowait(msg) } catch { dead.push(q) }
}

// Sau:
for (const q of clients) {
    try {
        q.put_nowait(msg)
    } catch (e) {
        if (e instanceof QueueFullError) {
            dead.push(q)
        } else {
            console.error(`[shell-proxy] Unexpected error broadcasting to client: ${e}`)
            dead.push(q)
        }
    }
}
```

---

### F-05 · Unvalidated Flow ID After Timeout
**File:** `scripts/workflow/lib/dispatch.sh` (lines 44–59)  
**Severity:** HIGH  
**Risk:** Empty `flow_id` dẫn đến ambiguous log correlation

**Fix:**
```bash
flow_id=$(WF_STATE_FILE="$STATE_FILE" timeout 30 python3 - <<'PY' ...) || { log_error "..."; exit 1; }

# Thêm validation ngay sau:
if [[ -z "$flow_id" ]]; then
    log_warn "flow_id empty after python block, generating fallback UUID"
    flow_id="fallback-$(python3 -c 'import uuid; print(uuid.uuid4())')"
fi
```

---

## Phase 2 — Medium Priority (v0.0.6 / next sprint)

### F-06 · Manifest Path Mismatch in dispatch.sh
**File:** `scripts/workflow/lib/dispatch.sh` (line 691)  
**Fix:** Thay hard-coded `workflows/runtime/evidence/step-${step}-manifest.json` bằng `wf_evidence_manifest_path()`. Audit tất cả chỗ dùng path literal này.

### F-07 · Unchecked File Globs in mercenary.sh
**File:** `scripts/workflow/lib/mercenary.sh` (line 203)  
**Fix:** `wf_mercenary_scan()` phải luôn echo valid JSON (hoặc `[]`) khi early return. Thêm `echo "[]"` vào branch `[[ ! -d "$merc_dir" ]] && echo "[]" && return 0`.

### F-08 · Missing Project Root Fallback Validation in monitor-web.py
**File:** `scripts/monitor-web.py` (line 23)  
**Fix:** Nếu `FLOWCTL_PROJECT_ROOT` được set nhưng path không tồn tại hoặc không readable → warn rõ ra stderr + fallback, không silent. Không tiếp tục với path sai.

### F-09 · Incomplete Error Handling in Brief Generation
**File:** `scripts/workflow/lib/dispatch.sh` (lines 77–242)  
**Fix:** Wrap top-level Python block trong try-except, print rõ file nào gây lỗi trước khi exit.

### F-10 · Windows Path Handling Consistency
**Files:** `dispatch.sh`, `monitor-web.py`  
**Fix:** Apply cygpath conversion pattern từ `flowctl.sh` (lines 45–48) vào tất cả Python subprocess invocations. Standardize: nhận mixed-case paths, normalize bằng `pathlib.Path.resolve()`.

### F-11 · Stale PID Cleanup in Idempotency State
**File:** `scripts/workflow/lib/orchestration.sh` (lines 133–167)  
**Fix:** Thêm `--stale-pids` flag vào monitor command. Auto-clean PID entries khi `os.kill(pid, 0)` raises `ProcessLookupError` VÀ entry age > 2 giờ. Tích hợp vào `team recover --auto`.

### F-12 · Missing FLOWCTL_HOME Permission Validation
**File:** `scripts/workflow/lib/config.sh` (line 46)  
**Fix:** Trong `flowctl_ensure_data_dirs()`, thêm:
```bash
if [[ ! -w "$FLOWCTL_HOME" ]]; then
    wf_error "FLOWCTL_HOME ($FLOWCTL_HOME) is not writable. Check permissions."
    exit 1
fi
```

---

## Phase 3 — Low Priority (Nice to have)

| # | Issue | File | Fix tóm tắt |
|---|-------|------|-------------|
| L-01 | Empty role list edge case | `dispatch.sh` L95-100 | Exit với error rõ ràng nếu `roles` list rỗng sau dedup |
| L-02 | Token estimation accuracy (Vietnamese) | `shell-proxy.js` L76-90 | Document limitation hoặc add TikToken fallback |
| L-03 | No timeout on mercenary wait | `mercenary.sh` | Thêm `--mercenary-timeout` param, default 3600s |
| L-04 | Circuit breaker lacks jitter | `budget.sh` L206-222 | Exponential backoff 1.5x up to max 1800s |
| L-05 | Deprecation warning spam | `common.sh`, `state.sh`, `gate.sh` | `~/.flowctl/seen-deprecations.txt`, warn once/day |
| L-06 | f-string injection risk | `dispatch.sh` L284+ | Dùng `json.dumps()` / `shlex.quote()` thay string interpolation trực tiếp |
| L-07 | Inconsistent exit codes | `dispatch.sh` L125-127 | Document: 0=success, 1=logical error, 2=policy violation, 255=fatal |
| L-08 | monitor-web global mode regression | `monitor-web.py` | Verify `discover_projects()` scan meta.json only, không đọc events.jsonl |

---

## Phase 4 — Test Coverage (Song song với Phase 1-2)

### Critical test gaps cần viết ngay:

**TC-01 · Race condition / concurrency**
- Spawn 5 parallel headless dispatches cùng step → verify chỉ 1 LAUNCH
- 2 concurrent `flowctl approve` → JSON không corrupt
- Parallel `wf_budget_prelaunch_check()` → token cap vẫn enforced

**TC-02 · JSON lock under contention**
- 10 parallel `wf_json_set` cùng key → verify final value hợp lệ
- Interleaved append + set → JSON remains valid

**TC-03 · Error recovery**
- `.flowctl-lock` với stale PID → reclaim logic hoạt động
- Corrupt `registry.json` → clear error hoặc recovery
- `FLOWCTL_HOME` read-only → fail rõ ràng, không silent

**TC-04 · Evidence & manifest integrity**
- Corrupt report file sau capture → manifest detects mismatch
- Thêm unexpected file → "unexpected_files" error
- Xóa manifest → gate-check fails với `manifest_missing`

**TC-05 · Mercenary & Phase B spawn**
- Report có `NEEDS_SPECIALIST` → `wf_mercenary_scan` detect đúng
- Spawn mercenary → output inject vào next brief

**TC-06 · Dispatch policy violations**
- `--launch` trên non-macOS → mode check rejects
- `--trust` khi policy forbids → `POLICY_VIOLATION` output
- Invalid `--max-retries` → default fallback

**TC-07 · Breaker & budget state machine**
- Trigger open via cap breach → half-open probe works
- Override while open → `budget_override_already_used` on 2nd attempt
- Probe success → breaker closes
- Manual reset → state clears

**TC-08 · MCP server (medium priority)**
- `wf_state()` gọi 2 lần → call 2 là cache hit
- Corrupt cache → MCP detect và refresh
- `flow_advance_step` → calls `flowctl approve` đúng

**TC-09 · Windows/Git Bash paths**
- Chạy full test suite trên Git Bash (Windows)
- Dispatch với `FLOWCTL_RUNTIME_DIR` ngoài repo

---

## Execution Order

```
Week 1:  F-01, F-02, F-03, F-04, F-05  (Phase 1 — tất cả critical/high)
         TC-01, TC-02 (race condition tests để verify fix)

Week 2:  F-06, F-07, F-08, F-09, F-12  (Phase 2 — high-impact mediums)
         TC-03, TC-04, TC-05, TC-06    (error recovery + dispatch tests)

Week 3:  F-10, F-11                     (Windows + stale PID)
         TC-07, TC-08                   (breaker + MCP tests)

Backlog: Phase 3 (Low) + TC-09 (Windows CI)
```

---

*Generated from: flowctl-audit-report.pdf — April 26, 2026*
