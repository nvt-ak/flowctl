# Graphify: contract, when to use, CLI, workflow

> Lazy reference — [SKILL.md](../SKILL.md)


# Graphify Code Structure Graph
# Skill: Graphify Integration | Version: 2.1.0

## ⚠️ Quan Trọng: Graphify là Code Graph, KHÔNG phải Workflow Graph

Graphify tự động extract code structure từ source code.
- ✅ **Chứa**: functions, classes, modules, imports, call relationships
- ❌ **KHÔNG chứa**: requirements, decisions, blockers, step outcomes, project data
- ❌ **KHÔNG có write API**: `graphify_update_node`, `graphify_snapshot` không tồn tại

Để load workflow context → dùng **`wf_step_context()`** thay thế.

---

## 1. Khi Nào Dùng Graphify

Chỉ dùng ở **steps 4-8** (Backend, Frontend, Integration, QA, DevOps) khi cần:
- Hiểu codebase structure trước khi implement
- Tìm dependencies của một module/service
- Trace call flows giữa các components
- Xác định high-impact code (god nodes) trước khi refactor

---

## 2. Cách Dùng — Direct File Access (KHÔNG có MCP server)

Graphify **không** có MCP server. Đọc output files trực tiếp:

```bash
# Build graph (một lần sau khi clone / khi code thay đổi lớn)
python3 -m graphify update .

# Files output:
#   graphify-out/graph.json       ← full graph: nodes, edges, clusters, call_graph
#   graphify-out/GRAPH_REPORT.md  ← human-readable overview
```

**Đọc overview trước:**
```bash
cat graphify-out/GRAPH_REPORT.md   # clusters, top nodes, stats
```

**Đọc graph data khi cần chi tiết:**
```python
import json
graph = json.load(open("graphify-out/graph.json"))
# graph["nodes"]   — dict of id → {name, type, file, line, ...}
# graph["edges"]   — list of {source, target, type}
# graph["clusters"] — list of related-code groups
```

---

## 3. Workflow Trước Khi Query

```
1. Kiểm tra graph tồn tại: ls graphify-out/graph.json
2. Đọc overview: graphify-out/GRAPH_REPORT.md
3. Query cụ thể bằng ngôn ngữ tự nhiên
```

Nếu `graph.json` chưa có: `python3 -m graphify update .`
