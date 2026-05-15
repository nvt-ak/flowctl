## 1. Introduction

### 1.1 Document Purpose

**Product Name:** flowctl (`@cursor-kit/flowctl` — mô tả wiki)

**Document Version:** v1.0

**Intended Audience:**
- Kỹ sư phần mềm / DevOps (vận hành CLI, hooks, CI)
- PM / Tech Lead (orchestration bước workflow, gate, approval)
- QA (kiểm tra hành vi gate, evidence, báo cáo worker)
- Agent AI trong Cursor (MCP, shell-proxy, workflow-state)

**Mục đích tài liệu:** Ghi nhận yêu cầu chức năng và phi chức năng của **flowctl** như một CLI bash-first điều phối workflow sản phẩm/kỹ thuật trong Cursor, kèm MCP và công cụ quan sát — theo cấu trúc SRS Kaopiz.

### 1.2 Document Conventions

**Requirement ID Format:**
- Use Case: `UC-01`, `UC-02`, …
- System Feature: `F-01`, `F-02`, …
- Functional Requirement: `FR-XX-YY` (Feature-Number-SubNumber)
- Non-functional: `NFR-01`, …

**Notation Conventions:**
- **Bold:** thuật ngữ quan trọng hoặc tên module
- `Code/Technical terms:` lệnh CLI, tên file, biến môi trường

### 1.3 Project Scope

**Software Purpose:**  
flowctl điều phối **workflow theo bước** (state trong `flowctl-state.json`), vòng **đánh giá độ phức tạp → War Room (tùy chọn) → dispatch worker → collect → gate → phê duyệt**, tích hợp **MCP** để agent đọc/ghi ngữ cảnh có cấu trúc, **git hooks** đồng bộ chất lượng/nhánh, **catalog skills**, và **dashboard / audit token** cục bộ (theo wiki overview).

**Major Features (trích wiki — không bổ sung nghiệp vụ ngoài wiki):**
- Quản lý state workflow, policy, budget, idempotency, brief worker, collect, evidence, QA gate
- MCP `shell-proxy` (đọc/cache) và `workflow-state` (ghi qua `flowctl`)
- CLI `flowctl` + `merge_cursor_mcp.py` cho `.cursor/mcp.json`
- Telemetry web cục bộ (`scripts/monitor-web.py` qua `flowctl monitor`)
- Token audit (`scripts/token-audit.py` qua `flowctl audit-tokens` / `audit`)
- Skills catalog tooling (`scripts/workflow/skills/`)
- Git hooks và automation cục bộ (`scripts/hooks/`)

**Out of Scope (wiki không định nghĩa là sản phẩm lõi flowctl):**
- Logic nghiệp vụ ứng dụng của **dự án downstream** đang dùng flowctl (chỉ là consumer của CLI)
- Hosting dashboard lên internet công cộng — wiki mô tả bind `127.0.0.1`

### 1.4 References

| Reference ID | Title | Version | Date | Source/URL |
|----------------|-------|---------|------|------------|
| REF-WIKI-01 | flowctl — Wiki overview | — | 2026-05-14 | `.gitnexus/wiki/overview.md` |
| REF-WIKI-02 | Workflow orchestration engine | — | 2026-05-14 | `.gitnexus/wiki/workflow-orchestration-engine.md` |
| REF-WIKI-03 | MCP servers and Cursor MCP merge | — | 2026-05-14 | `.gitnexus/wiki/mcp-servers-and-cursor-mcp-merge.md` |
| REF-WIKI-04 | Workflow telemetry dashboard | — | 2026-05-14 | `.gitnexus/wiki/workflow-telemetry-dashboard.md` |
| REF-WIKI-05 | CLI and project setup | — | 2026-05-14 | `.gitnexus/wiki/cli-and-project-setup.md` |
| REF-WIKI-06 | Token usage auditing | — | 2026-05-14 | `.gitnexus/wiki/token-usage-auditing.md` |
| REF-WIKI-07 | Documentation module (orientation) | — | 2026-05-14 | `.gitnexus/wiki/documentation.md` |
