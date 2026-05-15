# Code review — Backend checklists (controller, service, repository)

> **Lazy reference** — load when reviewing APIs, services, or data access. Hub: [../SKILL.md](../SKILL.md).

## 4. Checklist Review Theo Loại File

### 4.1 Backend API Endpoints (Controller Layer)

```markdown
## Controller Review Checklist

### Input Validation
- [ ] Tất cả request params được validate (type, format, length, range)
- [ ] Tất cả request body được validate với schema (DTO/Zod/Joi)
- [ ] File uploads: type check, size limit, virus scan
- [ ] Query params: page/limit với min/max enforcement
- [ ] Path params: validate format (UUID, numeric, etc.)

### Authentication & Authorization
- [ ] Auth guard applied (không bỏ sót endpoint nào)
- [ ] Role/permission check ở đúng cấp (service, không chỉ controller)
- [ ] Resource ownership check (user can only access their own resources)
- [ ] Admin-only endpoints properly protected

### Response Handling
- [ ] Correct HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 500)
- [ ] Consistent response format (success/error structure)
- [ ] Sensitive data không có trong response (passwords, tokens, internal IDs)
- [ ] Pagination response includes total, page, limit
- [ ] Error messages không expose internal details

### Documentation
- [ ] OpenAPI/Swagger decorators hoàn chỉnh
- [ ] All response types documented
- [ ] Auth requirements documented
```

### 4.2 Service Layer

```markdown
## Service Review Checklist

### Business Logic
- [ ] Business rules được validate đầy đủ
- [ ] Edge cases được handle (empty lists, null values, concurrent updates)
- [ ] Transactions used khi cần (multiple DB operations)
- [ ] Idempotency considered cho write operations

### Error Handling
- [ ] Specific exception types (NotFound, Conflict, Validation, etc.)
- [ ] Error messages helpful và consistent
- [ ] Exception propagation đúng (không swallow errors)
- [ ] Logging ở mức phù hợp (không log PII)

### Performance
- [ ] N+1 query problems không tồn tại
- [ ] Batch operations instead of loops khi có thể
- [ ] Appropriate caching cho expensive operations
- [ ] Async operations handled correctly (không missing await)

### Testability
- [ ] Dependencies injected (không hardcoded)
- [ ] External calls isolated trong separate services/adapters
- [ ] Pure functions where possible
```

### 4.3 Database/Repository Layer

```markdown
## Repository Review Checklist

### Query Safety
- [ ] Parameterized queries (không string interpolation)
- [ ] SELECT only needed columns (không SELECT *)
- [ ] JOINs are correct và efficient
- [ ] Indexes exist cho WHERE clauses
- [ ] LIMIT applied cho queries có thể return nhiều rows

### Data Integrity
- [ ] Transactions wrap related operations
- [ ] Optimistic locking cho concurrent updates
- [ ] Soft delete used thay vì hard delete
- [ ] Cascade delete configured đúng

### Migrations
- [ ] Migration có cả up và down
- [ ] Migration là idempotent (safe to run multiple times)
- [ ] Data migrations handle null/empty cases
- [ ] Large table migrations không lock table (use batching)
```
