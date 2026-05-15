# Testing: integration

> Lazy reference — [SKILL.md](../SKILL.md)

## 3. Integration Testing

### 3.1 API Integration Tests (Supertest)

```typescript
import request from 'supertest'
import { createTestApp } from '../helpers/test-app'
import { createTestDatabase, clearDatabase } from '../helpers/test-database'

describe('POST /api/v1/users', () => {
  let app: Express
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    app = createTestApp({ database: db })
  })

  afterAll(async () => {
    await db.close()
  })

  afterEach(async () => {
    await clearDatabase(db)
  })

  it('201: creates user successfully with valid data', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      })
      .expect(201)

    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: 'newuser@example.com',
      name: 'New User',
    })
    expect(response.body.password).toBeUndefined()  // Password never in response

    // Verify persisted in database
    const dbUser = await db.users.findByEmail('newuser@example.com')
    expect(dbUser).not.toBeNull()
    expect(dbUser!.password).not.toBe('SecurePass123!')  // Should be hashed
  })

  it('400: returns validation errors for invalid data', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'not-valid-email',
        password: '123',  // Too short
      })
      .expect(400)

    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', message: expect.any(String) }),
        expect.objectContaining({ field: 'password', message: expect.any(String) }),
        expect.objectContaining({ field: 'name', message: expect.any(String) }),
      ])
    )
  })

  it('409: returns conflict when email already exists', async () => {
    // Create user first
    await db.users.create({ email: 'existing@example.com', name: 'Existing', password: 'hashed' })

    await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'existing@example.com', password: 'pass123!', name: 'Duplicate' })
      .expect(409)
  })

  it('401: returns unauthorized without auth token', async () => {
    await request(app)
      .post('/api/v1/users')
      .send({ email: 'test@example.com', password: 'pass', name: 'Test' })
      .expect(401)
  })

  it('403: returns forbidden for non-admin users', async () => {
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ email: 'test@example.com', password: 'pass', name: 'Test' })
      .expect(403)
  })
})
```

### 3.2 Contract Tests (Pact)

```typescript
// Consumer side (Frontend defines expected contract)
describe('User API Contract', () => {
  const provider = new PactV3({
    consumer: 'frontend-app',
    provider: 'user-api',
  })

  it('can get a user by ID', async () => {
    await provider.addInteraction({
      states: [{ description: 'a user with ID user-123 exists' }],
      uponReceiving: 'a request for user by ID',
      withRequest: {
        method: 'GET',
        path: '/api/v1/users/user-123',
        headers: { Authorization: like('Bearer token') },
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: like('user-123'),
          email: like('user@example.com'),
          name: like('John Doe'),
          role: like('user'),
          createdAt: like('2026-04-23T10:00:00.000Z'),
          // Verify password is NOT in response
        },
      },
    })

    const result = await userService.getUserById('user-123', 'Bearer token')
    expect(result.id).toBe('user-123')
  })
})
```

