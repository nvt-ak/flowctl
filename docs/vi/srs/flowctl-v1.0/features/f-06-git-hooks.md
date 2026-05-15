## F-06 Git hooks và automation cục bộ

### F-06.1 Description

**Feature Name:** Git hooks (`scripts/hooks/`)

**Priority:** Medium

**Brief Description:**  
Wiki **overview** và `meta.json` liệt kê hooks: `prevent-main-commit`, `prevent-main-push`, `invalidate-cache`, `log-bash-event`, `run-quality-gate`, `generate-token-report`, `setup-git-hooks.mjs`. Giữ nhánh/cache/gate cục bộ thẳng hàng với kỳ vọng flowctl.

**Brief Description chi tiết từng hook:**  
TBD — wiki module **Git hooks and local automation** chưa được nhập nguyên văn vào SRS này; bổ sung khi đồng bộ file wiki tương ứng.

---

### F-06.3 Functional Requirements

| Req ID | Requirement Description | Priority | Status |
|--------|---------------------------|----------|--------|
| FR-06-01 | Hooks được liệt kê trong `.gitnexus/wiki/meta.json` phải có tài liệu hành vi tại wiki con hoặc source | Medium | Draft |
