## F-02 MCP servers và merge Cursor MCP

### F-02.1 Description

**Feature Name:** `shell-proxy.js`, `workflow-state.js`, `merge_cursor_mcp.py`

**Priority:** High

**Brief Description:**  
MCP stdio cho đọc state/git/files có cache + token logging; mutation qua `flowctl`; merge an toàn vào `.cursor/mcp.json` và merge non-destructive vào `~/.cursor/mcp.json` — wiki **MCP servers and Cursor MCP merge**.

**Related Use Cases:** UC-03

---

### F-02.2 Stimulus/Response Sequences

**Sequence: Invalidate sau thay đổi state**

| Step | Actor/Action | System Response |
|------|----------------|-----------------|
| 1 | Agent gọi `wf_cache_invalidate` với scope `state`/`git`/`all` | Bump generation trong `_gen.json`, log invalidate event |
| 2 | Agent gọi lại `wf_read` / `wf_git` | Cache miss hoặc hit theo strategy |

---

### F-02.3 Functional Requirements

| Req ID | Requirement Description | Priority | Status |
|--------|---------------------------|----------|--------|
| FR-02-01 | `shell-proxy` resolve `REPO` = `FLOWCTL_PROJECT_ROOT \|\| cwd` | High | Draft |
| FR-02-02 | Cache strategies: `static`, `git`, `state`, `ttl`, `mtime` như bảng wiki | High | Draft |
| FR-02-03 | Tools `wf_*` được liệt kê đầy đủ trong wiki phải tồn tại với hành vi tương ứng (wf_set_agent, wf_cache_invalidate không bọc withLogging) | High | Draft |
| FR-02-04 | `flow_*` gọi `execFileSync('flowctl', args, { cwd: REPO_ROOT })` | High | Draft |
| FR-02-05 | Merge: không overwrite server trùng tên đã user-customize; `--overwrite` drop keys ngoài `mcpServers` trên file project | High | Draft |

**Dependencies:** Node `@modelcontextprotocol/sdk`, `flowctl` executable.
