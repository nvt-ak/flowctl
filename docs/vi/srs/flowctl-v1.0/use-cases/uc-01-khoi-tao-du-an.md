# Use Case: Khởi tạo và scaffold dự án

**Use Case ID:** UC-01  
**Version:** 1.0  
**Status:** Draft

---

## 1. Use Case Overview

**Use Case Name:** Khởi tạo và scaffold dự án (`flowctl init`, MCP merge, policy/gate seed)

**Brief Description:**  
Người vận hành khởi tạo `flowctl-state.json`, merge MCP vào `.cursor/mcp.json`, copy seed policy/gate, scaffold `.cursor` và meta dưới `~/.flowctl/projects/` — theo wiki **CLI and project setup**.

**Actor(s):**
- **Primary Actor:** Developer
- **Secondary Actor(s):** TBD — CI tự `init` nếu có pipeline (wiki không mô tả chi tiết)

**Priority:** High

**Preconditions:**
- Có `bash`, `python3`, khả năng chạy `merge_cursor_mcp.py`
- Biến `PROJECT_ROOT` / cwd trỏ repo mục tiêu

**Postconditions:**
- `flowctl-state.json` tồn tại (hoặc được ghi đè theo flag)
- `.cursor/mcp.json` đã merge scaffold/setup tùy luồng
- Thư mục runtime/cache được resolve (wiki: `FLOWCTL_DATA_DIR`, `meta.json`)

**Trigger:** Người dùng chạy `flowctl init` (hoặc lần đầu setup tương đương).

---

## 2. Main Success Scenario (Basic Flow)

1. Developer chạy `flowctl init` với tên project / flags phù hợp.
2. Hệ thống xác định `is_new_project`, tùy chọn giữ `flow_id` khi overwrite (wiki).
3. Hệ thống gọi `ensure_project_scaffold`: seed state, merge MCP, copy `.claude/settings.json`, tạo `workflows/gates/`, policies, merge `.cursor/*`, `.cursorrules`.
4. Hệ thống ghi Python embedded: `project_name`, `current_step=1`, `flow_id`, timestamps.
5. Hệ thống resolve `FLOWCTL_DATA_DIR`, cache paths, ghi `meta.json` dưới `FLOWCTL_HOME/projects/`.
6. Nếu không `--no-setup`: chạy `scripts/setup.sh` (Graphify, GitNexus, index, v.v. theo mode).
7. Use case kết thúc thành công.

---

## 3. Alternative Flows

### 3.1 Alternative Flow A: Merge MCP thất bại (invalid JSON)

**Condition:** `merge_cursor_mcp.py` exit 2, `MCP_STATUS=invalid_json`.

**Flow:** In ra cảnh báo theo wiki; có thể không cập nhật `mcp.json` — operator sửa file thủ công rồi chạy lại.

### 3.2 Alternative Flow B: Bỏ setup

**Condition:** `--no-setup` hoặc `FLOWCTL_SKIP_SETUP=1`.

**Flow:** Bỏ qua `setup.sh`; các bước scaffold vẫn theo `ensure_project_scaffold`.

---

## 4. Special Requirements

- Khóa workflow (`wf_acquire_flow_lock`) áp dụng cho `init` (wiki CLI).

**SRS Reference:** Section 1.3, Section 4 (F-05).
