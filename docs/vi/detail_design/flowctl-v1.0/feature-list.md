# Feature List — Detail Design (flowctl)

**SRS Reference:** Section 4

| Feature ID | Name | SRS Reference | Priority | Status | Link |
|------------|------|---------------|----------|--------|------|
| F-01 | Workflow orchestration engine | F-01 | High | Draft | [features/f-01-workflow-engine-detail.md](features/f-01-workflow-engine-detail.md) |
| F-02 | MCP servers + merge | F-02 | High | Draft | [features/f-02-mcp-servers-detail.md](features/f-02-mcp-servers-detail.md) |
| F-03 | Telemetry dashboard | F-03 | Medium | Draft | [features/f-03-telemetry-dashboard-detail.md](features/f-03-telemetry-dashboard-detail.md) |
| F-04 | Token audit | F-04 | Medium | Draft | [features/f-04-token-audit-detail.md](features/f-04-token-audit-detail.md) |
| F-05 | CLI scaffold | F-05 | High | Draft | [features/f-05-cli-scaffold-detail.md](features/f-05-cli-scaffold-detail.md) |
| F-06 | Git hooks và automation | F-06 | Medium | Draft | [features/f-06-git-hooks-detail.md](features/f-06-git-hooks-detail.md) |
| F-07 | Skills catalog tooling | F-07 | Low | Draft | [features/f-07-skills-catalog-detail.md](features/f-07-skills-catalog-detail.md) |

### Feature Dependencies

| Feature | Depends On | Description |
|---------|------------|-------------|
| F-03 | F-02 | Đọc `events.jsonl` / stats do shell-proxy ghi |
| F-02 | F-05 | `flowctl` path / project root từ init/scaffold |
| F-01 | F-05 | State file + policy seed từ scaffold |
| F-06 | F-02 | `invalidate-cache.sh` bump `_gen.json` cho shell-proxy |
| F-06 | F-05 | `flowctl.sh` gọi invalidate sau lệnh đổi state |
| F-07 | F-05 | Scaffold đảm bảo `.cursor/skills` tồn tại |
