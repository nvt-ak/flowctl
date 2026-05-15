## F-05 CLI entry và project scaffold

### F-05.1 Description

**Feature Name:** `scripts/flowctl.sh`, `scripts/setup.sh`

**Priority:** High

**Brief Description:**  
Resolve `WORKFLOW_ROOT`/`PROJECT_ROOT`, source thư viện theo thứ tự cố định, `ensure_project_scaffold`, `cmd_init`, optional `setup.sh` pipeline — wiki **CLI and project setup**.

**Related Use Cases:** UC-01

---

### F-05.3 Functional Requirements

| Req ID | Requirement Description | Priority | Status |
|--------|---------------------------|----------|--------|
| FR-05-01 | Export `FLOWCTL_HOME`, `FLOWCTL_DATA_DIR`, cache paths, `PYTHONUTF8` | High | Draft |
| FR-05-02 | `wf_acquire_flow_lock` cho tập lệnh wiki liệt kê (init, dispatch, collect, …) | High | Draft |
| FR-05-03 | `ensure_project_scaffold` thực hiện các bước seed state, merge MCP, gates/policies, `.cursor` merge policy | High | Draft |
| FR-05-04 | `setup.sh` modes: default all, `--mcp-only`, `--index-only`, nhánh `--no-index` như wiki | Medium | Draft |
