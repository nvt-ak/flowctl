# Testing: data, coverage, links

> Lazy reference — [SKILL.md](../SKILL.md)

## 7. Test Data Management

### 7.1 Test Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    email: 'admin@test.example.com',
    password: 'AdminPass123!',
    name: 'Test Admin',
    role: 'admin',
  },
  regularUser: {
    email: 'user@test.example.com',
    password: 'UserPass123!',
    name: 'Test User',
    role: 'user',
  },
  inactiveUser: {
    email: 'inactive@test.example.com',
    password: 'InactivePass123!',
    name: 'Inactive User',
    role: 'user',
    status: 'inactive',
  },
}

// Factory pattern cho tạo test data
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: generateTestId(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'user',
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  }
}

// Builders cho complex objects
export class OrderBuilder {
  private order: Partial<Order> = {}

  withUser(userId: string): this {
    this.order.userId = userId
    return this
  }

  withItems(items: OrderItem[]): this {
    this.order.items = items
    return this
  }

  withStatus(status: OrderStatus): this {
    this.order.status = status
    return this
  }

  build(): Order {
    return {
      id: generateTestId(),
      status: 'pending',
      createdAt: new Date(),
      ...this.order,
    } as Order
  }
}
```

### 7.2 Database Seeding cho Tests

```typescript
// tests/helpers/seed.ts
export async function seedTestDatabase(db: Database) {
  // Clear existing data
  await db.query('TRUNCATE users, orders, products RESTART IDENTITY CASCADE')

  // Seed users
  const [admin, user] = await Promise.all([
    db.users.create({
      email: 'admin@test.example.com',
      password: await bcrypt.hash('AdminPass123!', 10),
      role: 'admin',
      name: 'Test Admin',
    }),
    db.users.create({
      email: 'user@test.example.com',
      password: await bcrypt.hash('UserPass123!', 10),
      role: 'user',
      name: 'Test User',
    }),
  ])

  return { admin, user }
}
```

## 8. Coverage Reports và Thresholds

### 8.1 Jest Coverage Configuration

```json
// jest.config.json
{
  "coverageThresholds": {
    "global": {
      "branches": 75,
      "functions": 85,
      "lines": 80,
      "statements": 80
    },
    "src/services/**/*.ts": {
      "branches": 90,
      "functions": 90,
      "lines": 90
    },
    "src/api/security/**/*.ts": {
      "branches": 95,
      "functions": 95,
      "lines": 95
    }
  },
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.tsx",
    "!src/index.ts"
  ]
}
```

### 8.2 Coverage Report Interpretation

```
Coverage Summary:
Statements   : 85.23% ( 1247/1463 )   ← >= 80% ✅
Branches     : 78.45% ( 456/581 )     ← >= 75% ✅
Functions    : 88.12% ( 312/354 )     ← >= 85% ✅
Lines        : 85.18% ( 1234/1449 )   ← >= 80% ✅

Uncovered lines (examples to address):
src/services/payment.service.ts | 145, 167-172
→ Investigate: Are these error paths? Add tests for them.

src/api/webhooks.controller.ts | 89-102
→ These lines need integration tests, not just unit tests.
```

## 9. Liên Kết

- QA Agent: `.cursor/agents/qa-agent.md`
- Backend testing details: `.cursor/agents/backend-dev-agent.md`
- Frontend testing details: `.cursor/agents/frontend-dev-agent.md`
- QA Testing step: `workflows/steps/07-qa-testing.md`
- Code review skill: `.cursor/skills/core/code-review/SKILL.md`
