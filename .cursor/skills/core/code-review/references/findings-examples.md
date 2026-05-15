# Code review — Common findings & fix patterns

> **Lazy reference** — load when you need copy-paste examples (security, performance, quality, frontend). Hub: [../SKILL.md](../SKILL.md).

## 5. Common Review Findings Và Fixes

### 5.1 Security Findings

```typescript
// ❌ BLOCKER: SQL Injection
const query = `SELECT * FROM users WHERE id = ${userId}`

// ✅ Fix: Parameterized query
const query = `SELECT * FROM users WHERE id = $1`
db.query(query, [userId])

// ---

// ❌ BLOCKER: Timing attack vulnerability
if (providedToken === expectedToken) { ... }

// ✅ Fix: Constant-time comparison
import { timingSafeEqual } from 'crypto'
const safe = timingSafeEqual(
  Buffer.from(providedToken),
  Buffer.from(expectedToken)
)

// ---

// ❌ BLOCKER: Hardcoded secret
const apiKey = "sk-hardcoded-example"

// ✅ Fix: Environment variable
const apiKey = process.env.REQUIRED_SERVICE_API_KEY
if (!apiKey) throw new Error('REQUIRED_SERVICE_API_KEY is not configured')

// ---

// ❌ IMPORTANT: Missing authorization check
async getUser(id: string) {
  return this.userRepository.findById(id)  // Any authenticated user can get any user
}

// ✅ Fix: Ownership check
async getUser(id: string, requestingUserId: string) {
  if (id !== requestingUserId && !await this.isAdmin(requestingUserId)) {
    throw new ForbiddenException('Cannot access other users data')
  }
  return this.userRepository.findById(id)
}
```

### 5.2 Performance Findings

```typescript
// ❌ BLOCKER: N+1 Query
const orders = await Order.findAll()
for (const order of orders) {
  order.user = await User.findById(order.userId)  // N+1!
}

// ✅ Fix: Eager loading
const orders = await Order.findAll({
  include: [{ model: User }]
})

// ---

// ❌ IMPORTANT: Missing pagination
async getProducts(): Promise<Product[]> {
  return this.productRepo.findAll()  // Could return millions of rows
}

// ✅ Fix: Always paginate
async getProducts(page: number = 1, limit: number = 20): Promise<PaginatedResult<Product>> {
  const [items, total] = await this.productRepo.findAndCount({
    skip: (page - 1) * limit,
    take: Math.min(limit, 100),  // Enforce max limit
  })
  return { items, total, page, limit }
}

// ---

// ❌ IMPORTANT: Missing index
// Migration có WHERE clause trên email nhưng không có index

// ✅ Fix: Add index
await queryInterface.addIndex('users', ['email'], { unique: true })

// ---

// ❌ SUGGESTION: Sequential async calls that could be parallel
const user = await getUser(id)
const orders = await getOrders(userId)  // Can run in parallel

// ✅ Fix: Parallel execution
const [user, orders] = await Promise.all([
  getUser(id),
  getOrders(userId),
])
```

### 5.3 Code Quality Findings

```typescript
// ❌ IMPORTANT: Magic numbers/strings
if (status === 2) { ... }  // What is 2?
const TIMEOUT = 86400000   // What is this?

// ✅ Fix: Named constants
const UserStatus = {
  ACTIVE: 1,
  INACTIVE: 2,
  BANNED: 3,
} as const

const ONE_DAY_MS = 24 * 60 * 60 * 1000

// ---

// ❌ IMPORTANT: Error swallowing
try {
  await sendEmail(user.email, template)
} catch (e) {
  // Silently ignore
}

// ✅ Fix: Handle or propagate
try {
  await sendEmail(user.email, template)
} catch (error) {
  logger.error('Failed to send email', { userId: user.id, error })
  // Re-throw if critical, or handle gracefully
  throw new ServiceError('Email delivery failed', { cause: error })
}

// ---

// ❌ NITPICK: Inconsistent naming
async function get_user(userId: string) { ... }  // snake_case in JS/TS

// ✅ Fix: camelCase
async function getUser(userId: string) { ... }
```

### 5.4 Frontend Findings (XSS / effects / a11y)

Use a vetted HTML sanitizer for any HTML rendered from untrusted input; avoid raw HTML injection patterns.

```tsx
// ❌ BLOCKER: raw HTML from user input without sanitization
// Pattern: React prop that injects HTML string from user — use DOMPurify (or equivalent) first.

// ✅ Fix: sanitize before assigning to the HTML prop from your sanitizer library

// ---

// ❌ IMPORTANT: Memory leak - missing cleanup
useEffect(() => {
  const interval = setInterval(fetchData, 5000)
  // Missing cleanup!
}, [])

// ✅ Fix: Return cleanup function
useEffect(() => {
  const interval = setInterval(fetchData, 5000)
  return () => clearInterval(interval)  // Cleanup on unmount
}, [])

// ---

// ❌ IMPORTANT: Accessibility - no label
<input type="text" placeholder="Enter email" />

// ✅ Fix: Associate label
<label htmlFor="email">Email</label>
<input id="email" type="email" placeholder="Enter email" aria-describedby="email-error" />
<span id="email-error" role="alert">{error}</span>
```
