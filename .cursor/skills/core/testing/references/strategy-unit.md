# Testing: strategy & unit practices

> Lazy reference — [SKILL.md](../SKILL.md)

# Kỹ Năng Testing
# Skill: Software Testing | Used by: QA, Backend Dev, Frontend Dev | Version: 1.0.0

## 1. Testing Strategy Tổng Quan

### 1.1 Testing Pyramid
```
           ▲
          /E\          E2E Tests
         /   \         (ít nhất, chạy chậm, expensive)
        /─────\
       / Intg  \       Integration Tests
      /─────────\      (vừa phải, test boundaries)
     /  Unit     \     Unit Tests
    /─────────────\    (nhiều nhất, chạy nhanh, rẻ)
```

**Target distribution:**
- Unit Tests: 70% (fast, isolated, many)
- Integration Tests: 20% (test service boundaries, API contracts)
- E2E Tests: 10% (critical user journeys, slow but comprehensive)

### 1.2 Testing Types trong Dự Án

| Type | Tool | What | When |
|------|------|------|------|
| Unit | Jest/Vitest/pytest | Functions, classes, components | During development |
| Integration | Jest/pytest | API endpoints, service interactions | Step 4, 5 |
| Contract | Pact | API contracts frontend↔backend | Before Step 6 |
| E2E | Playwright | Critical user journeys | Step 6, 7 |
| Performance | k6 | Load, stress, spike testing | Step 7 |
| Security | OWASP ZAP + Snyk | DAST + dependency audit | Step 7, 8 |
| Accessibility | axe-core | WCAG compliance | Step 5, 7 |
| Visual Regression | Playwright + Percy | UI screenshot comparison | Step 5, 7 |

## 2. Unit Testing Best Practices

### 2.1 AAA Pattern (Arrange, Act, Assert)

```typescript
describe('UserService', () => {
  describe('createUser', () => {

    it('should create a user with hashed password', async () => {
      // ====== ARRANGE ======
      const mockRepo = createMockRepository<User>()
      const mockHasher = { hash: jest.fn().mockResolvedValue('hashed_password') }
      const service = new UserService(mockRepo, mockHasher)

      const input = {
        email: 'test@example.com',
        password: 'rawPassword123',
        name: 'John Doe',
      }

      mockRepo.save.mockResolvedValue({
        id: 'uuid-123',
        ...input,
        password: 'hashed_password',
        createdAt: new Date(),
      })

      // ====== ACT ======
      const result = await service.createUser(input)

      // ====== ASSERT ======
      expect(result.id).toBeDefined()
      expect(result.email).toBe('test@example.com')
      expect(result.password).toBeUndefined()  // Password should not be in response
      expect(mockHasher.hash).toHaveBeenCalledWith('rawPassword123')
      expect(mockRepo.save).toHaveBeenCalledTimes(1)
    })

    it('should throw ConflictException when email already exists', async () => {
      // Arrange
      const mockRepo = createMockRepository<User>()
      mockRepo.findByEmail.mockResolvedValue({ id: 'existing' })

      const service = new UserService(mockRepo, mockHasher)

      // Act & Assert
      await expect(
        service.createUser({ email: 'existing@example.com', password: 'pass', name: 'Jane' })
      ).rejects.toThrow(ConflictException)

      await expect(
        service.createUser({ email: 'existing@example.com', password: 'pass', name: 'Jane' })
      ).rejects.toThrow('Email already registered')
    })

    it('should throw ValidationException for invalid email format', async () => {
      const service = new UserService(createMockRepository(), mockHasher)

      await expect(
        service.createUser({ email: 'not-an-email', password: 'pass', name: 'Jane' })
      ).rejects.toThrow(ValidationException)
    })

  })
})
```

### 2.2 Test Doubles

```typescript
// === MOCK (verify interactions) ===
const mockEmailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
}

// Verify it was called correctly
expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith({
  to: 'user@example.com',
  name: 'John',
})

// === STUB (control return values) ===
const stubRepo = {
  findById: jest.fn().mockResolvedValue(mockUser),
  findAll: jest.fn().mockResolvedValue([mockUser1, mockUser2]),
  save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: 'new-id' })),
}

// === SPY (wrap real implementation) ===
const service = new UserService(realRepo, emailService)
const createSpy = jest.spyOn(service, 'createUser')

await service.createUser(data)

expect(createSpy).toHaveBeenCalledTimes(1)
expect(createSpy).toHaveBeenCalledWith(data)

// === FAKE (simplified working implementation) ===
class FakeUserRepository implements UserRepository {
  private users: Map<string, User> = new Map()

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async save(user: User): Promise<User> {
    const id = user.id ?? generateId()
    const saved = { ...user, id }
    this.users.set(id, saved)
    return saved
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user
    }
    return null
  }
}
```

### 2.3 Testing Edge Cases

```typescript
describe('calculateDiscount', () => {
  // Happy path
  it('should apply 10% discount for orders over $100', () => {
    expect(calculateDiscount(150, 'STANDARD')).toBe(15)
  })

  // Boundary conditions
  it('should NOT apply discount for orders exactly $100', () => {
    expect(calculateDiscount(100, 'STANDARD')).toBe(0)
  })

  it('should apply discount for orders $100.01', () => {
    expect(calculateDiscount(100.01, 'STANDARD')).toBeCloseTo(10.001)
  })

  // Invalid inputs
  it('should throw for negative amount', () => {
    expect(() => calculateDiscount(-50, 'STANDARD')).toThrow(ValidationError)
  })

  it('should return 0 for zero amount', () => {
    expect(calculateDiscount(0, 'STANDARD')).toBe(0)
  })

  // Null/undefined handling
  it('should handle null coupon code gracefully', () => {
    expect(calculateDiscount(150, null)).toBe(0)
  })

  // Large numbers
  it('should handle very large order amounts', () => {
    expect(calculateDiscount(1_000_000, 'STANDARD')).toBe(100_000)
  })

  // Concurrent scenarios (nếu có side effects)
  it('should be idempotent - same result on multiple calls', () => {
    const result1 = calculateDiscount(200, 'VIP')
    const result2 = calculateDiscount(200, 'VIP')
    expect(result1).toBe(result2)
  })
})
```

