# Documentation: README template, tracking, links

> Lazy reference — [SKILL.md](../SKILL.md)

## 6. README Template

```markdown
# {Project Name}

{One-liner mô tả project}

[![Build Status](badge-url)](ci-url)
[![Coverage](badge-url)](coverage-url)
[![License](badge-url)](license-url)

## Giới Thiệu

{2-3 đoạn mô tả project là gì, giải quyết vấn đề gì, và tại sao nó tồn tại.}

## Tính Năng Chính

- ✅ {Feature 1}
- ✅ {Feature 2}
- 🚧 {Feature 3 - in progress}

## Cài Đặt

### Yêu Cầu

- Node.js >= 20.0.0
- PostgreSQL >= 16.0
- Redis >= 7.0

### Cài Đặt Nhanh

```bash
# Clone repository
git clone https://github.com/{org}/{repo}.git
cd {repo}

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env với credentials của bạn

# Run database migrations
npm run db:migrate

# Seed data (development only)
npm run db:seed

# Start development server
npm run dev
# → http://localhost:3000
```

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost/db` |
| `REDIS_URL` | Yes | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) | `your-secret-here` |
| `SMTP_HOST` | No | Email server host | `smtp.sendgrid.net` |

## Phát Triển

### Project Structure

```
src/
  api/         # API route handlers
  services/    # Business logic
  models/      # Database models
  utils/       # Shared utilities
tests/
  unit/        # Unit tests
  integration/ # Integration tests
  e2e/         # End-to-end tests
docs/
  adr/         # Architecture Decision Records
  api/         # OpenAPI specification
```

### Development Commands

```bash
npm run dev          # Start dev server with hot reload
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:cov     # Run tests with coverage report
npm run lint         # Run linter
npm run type-check   # TypeScript type check
npm run build        # Build for production
```

### Coding Conventions

- Follow `.cursorrules` cho tất cả conventions
- Run `npm run lint` trước khi commit
- Viết tests cho mọi business logic
- Document public APIs với JSDoc

## Deployment

Xem `.cursor/agents/devops-agent.md` và `workflows/steps/08-devops-deployment.md`

## Contributing

1. Đọc quy trình trong `workflows/it-product-flowctl.md`
2. Tạo branch theo convention: `gitnexus branch create "{description}"`
3. Viết code và tests
4. Submit PR và chờ review

## License

{License type} - xem [LICENSE](LICENSE) để biết thêm.
```

## 7. Documentation Tracking

Lưu documentation status trong step summary và flowctl state:

```bash
# Khi hoàn thành documentation
flowctl add-decision "docs-complete: API={api_pct}%, ADRs={adr_count}, README=updated"

# Cấu trúc docs chuẩn
docs/
  api/openapi.yaml              ← API spec
  adr/ADR-{id}-{title}.md      ← Architecture decisions
  runbooks/                     ← Operational guides
workflows/steps/{N}-*/          ← Step-level docs
```

## 8. Liên Kết

- Global rules cho doc standards: `.cursor/rules/core-rules.mdc`
- Step summary template: `.cursor/templates/step-summary-template.md`
- Tech Lead ADR process: `.cursor/agents/tech-lead-agent.md`
- Code documentation: Trong từng agent definition file
