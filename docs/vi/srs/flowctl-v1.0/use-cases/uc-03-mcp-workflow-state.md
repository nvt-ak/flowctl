# Use Case: Đọc/ghi trạng thái workflow qua MCP

**Use Case ID:** UC-03  
**Version:** 1.0  
**Status:** Draft

---

## 1. Use Case Overview

**Use Case Name:** Agent sử dụng MCP `shell-proxy` và `workflow-state` thay cho shell thô

**Brief Description:**  
Agent gọi `wf_state`, `wf_git`, `wf_step_context`, … với cache và logging token; mutation qua `flow_*` gọi `flowctl` — theo wiki **MCP servers and Cursor MCP merge**.

**Actor(s):**
- **Primary Actor:** Agent AI (Cursor)
- **Secondary Actor:** Developer (cấu hình `mcp.json`)

**Priority:** High

**Preconditions:**
- MCP server chạy với `cwd` = project root hoặc `FLOWCTL_PROJECT_ROOT` hợp lệ
- `flowctl` khả dụng cho `workflow-state.js`

**Postconditions:**
- Kết quả công cụ JSON; event ghi `events.jsonl` / stats cập nhật (shell-proxy)

**Trigger:** Agent invoke MCP tool từ Cursor.

---

## 2. Main Success Scenario (Basic Flow)

1. Cursor spawn `shell-proxy.js` / `workflow-state.js` (stdio).
2. Agent gọi `wf_state` → handler đọc `flowctl-state.json`, trả JSON compact, cache strategy `state`.
3. Khi cần mutate: agent gọi `flow_add_blocker` / `flow_advance_step` / … → `execFileSync('flowctl', args)`.
4. Sau thay đổi git/state quan trọng, agent có thể gọi `wf_cache_invalidate`.
5. Use case kết thúc thành công.

---

## 3. Alternative Flows

### 3.1 Thiếu `flowctl-state.json`

**Condition:** File không tồn tại.

**Flow:** `flow_get_state` trả error object (wiki); `shell-proxy` có thể báo lỗi có cấu trúc.

---

## 4. Special Requirements

Registry heartbeat 60s với lock file (wiki). Không bịa thêm tool ngoài danh sách wiki.

**SRS Reference:** Section 4 — F-02.
