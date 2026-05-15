# Graphify: role patterns, lazy rule, rebuild

> Lazy reference — [SKILL.md](../SKILL.md)

---

## 4. Patterns Đọc Graph Theo Role

### Backend Dev (Step 4)
```python
import json
g = json.load(open("graphify-out/graph.json"))
# Tìm nodes liên quan đến database/auth
db_nodes = [n for n in g["nodes"].values() if "db" in n["name"].lower() or "repo" in n["name"].lower()]
# Tìm edges gọi đến UserService
user_callers = [e for e in g["edges"] if e["target"] == "UserService"]
```

### Tất cả roles
```bash
# Bước 1 — luôn đọc overview trước
cat graphify-out/GRAPH_REPORT.md

# Bước 2 — tìm nodes theo tên/file
python3 -c "
import json
g = json.load(open('graphify-out/graph.json'))
keyword = 'auth'  # thay bằng keyword cần tìm
hits = [n for n in g.get('nodes', {}).values() if keyword in n.get('name','').lower()]
for h in hits[:10]: print(h.get('name'), '—', h.get('file',''))
"

# Bước 3 — xem cluster (nhóm code liên quan)
python3 -c "
import json
g = json.load(open('graphify-out/graph.json'))
for c in g.get('clusters', [])[:5]: print(c)
"
```

---

## 5. Lazy Loading Rule

Chỉ dùng Graphify khi graph có data:
```bash
# Check trước khi query
ls graphify-out/graph.json 2>/dev/null && echo "Graph available" || echo "Run: python3 -m graphify update ."
```

Graph rỗng hoặc stale → đọc code trực tiếp, không query graph.

---

## 6. Rebuild Graph

```bash
# Từ project root
python3 -m graphify update .

# Output: graphify-out/graph.json
# Overview: graphify-out/GRAPH_REPORT.md
```

Git hook tự động rebuild khi commit (nếu đã cài `python3 -m graphify hook install`).
