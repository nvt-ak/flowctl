# Documentation: overview, code standards, OpenAPI

> Lazy reference — [SKILL.md](../SKILL.md)

# Kỹ Năng Documentation
# Skill: Technical Documentation | Used by: All agents | Version: 1.0.0

## 1. Tổng Quan

Documentation là một phần không thể tách rời của quality software. Tất cả agents phải đảm bảo:
- Code được document đầy đủ cho người đọc tiếp theo
- Decisions được recorded để future maintainers hiểu "why"
- APIs được spec'd để enable independent development
- Processes được document để onboarding nhanh hơn

## 2. Code Documentation Standards

### 2.1 TypeScript/JavaScript (JSDoc)

```typescript
/**
 * Xử lý yêu cầu đặt lại mật khẩu cho người dùng.
 *
 * Quy trình:
 * 1. Kiểm tra email tồn tại trong hệ thống
 * 2. Tạo token reset ngẫu nhiên (64 bytes, hex-encoded)
 * 3. Lưu token với TTL 1 giờ vào Redis
 * 4. Gửi email chứa reset link
 *
 * @param email - Email của người dùng cần reset password
 * @returns Promise<void> - Luôn resolve thành công (không tiết lộ email có tồn tại không)
 *
 * @throws {ValidationError} Khi email không đúng định dạng
 * @throws {EmailDeliveryError} Khi không gửi được email (sau 3 lần retry)
 *
 * @example
 * ```typescript
 * // Usage trong controller
 * await authService.initiatePasswordReset('user@example.com')
 * // → Sends reset email if email exists, silently succeeds if not
 * ```
 *
 * @security
 * - Luôn return success dù email có tồn tại hay không (prevent enumeration)
 * - Token được hash trước khi lưu vào database
 * - Token expired sau 1 giờ
 */
async initiatePasswordReset(email: string): Promise<void> {
  // Implementation
}

/**
 * Repository để quản lý User entities trong PostgreSQL.
 *
 * @example
 * ```typescript
 * const repo = new UserRepository(dataSource)
 * const user = await repo.findActiveByEmail('user@example.com')
 * ```
 */
export class UserRepository {

  /**
   * Tìm user active theo email (case-insensitive).
   *
   * @param email - Email cần tìm (sẽ được lowercase trước khi query)
   * @returns User nếu tìm thấy và đang active, null nếu không tìm thấy hoặc inactive
   */
  async findActiveByEmail(email: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOne({
      where: {
        email: email.toLowerCase(),
        status: UserStatus.ACTIVE,
      },
    })
  }
}
```

### 2.2 Python (Docstrings - Google Style)

```python
def calculate_order_total(
    items: list[OrderItem],
    discount_code: str | None = None,
    user_tier: str = "standard"
) -> OrderTotal:
    """
    Tính tổng giá trị đơn hàng bao gồm discount và thuế.

    Args:
        items: Danh sách các items trong đơn hàng. Không được rỗng.
        discount_code: Mã giảm giá tùy chọn. None nếu không áp dụng.
        user_tier: Tier của người dùng ('standard', 'premium', 'enterprise').
                   Ảnh hưởng đến discount rate. Mặc định là 'standard'.

    Returns:
        OrderTotal object chứa:
        - subtotal: Tổng trước discount và thuế
        - discount_amount: Số tiền được giảm
        - tax_amount: Số tiền thuế (VAT 10%)
        - total: Tổng cuối cùng

    Raises:
        ValidationError: Khi items list rỗng hoặc có item với quantity <= 0
        InvalidDiscountError: Khi discount_code không hợp lệ hoặc đã hết hạn
        ValueError: Khi user_tier không được hỗ trợ

    Example:
        >>> items = [OrderItem(product_id="p1", quantity=2, unit_price=50.0)]
        >>> total = calculate_order_total(items, discount_code="SAVE10")
        >>> print(f"Total: {total.total}")  # Total: 90.0
    """
    if not items:
        raise ValidationError("Order must have at least one item")

    # Calculate subtotal
    subtotal = sum(item.quantity * item.unit_price for item in items)
    # ... rest of implementation
```

### 2.3 Inline Comments - Khi Nên Viết

```typescript
// ✅ GOOD: Explain "why", not "what"

// Rate limiting để prevent brute force attacks - allow 5 attempts per 15 minutes
const rateLimiter = new RateLimiter({ max: 5, windowMs: 15 * 60 * 1000 })

// Use constant-time comparison to prevent timing attacks
// Regular string equality leaks information through execution time
const isValid = timingSafeEqual(
  Buffer.from(providedToken),
  Buffer.from(storedToken)
)

// PostgreSQL JSONB operators: @> means "contains"
// More efficient than extracting and comparing individual fields
const query = 'SELECT * FROM events WHERE metadata @> $1'

// Debounce 300ms to avoid hammering the search API on every keystroke
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
)

// ❌ BAD: State the obvious
const total = price * quantity  // Multiply price by quantity (obvious!)
const user = await getUser(id)  // Get user by id (obvious!)
```

## 3. API Documentation (OpenAPI 3.0)

### 3.1 OpenAPI Specification Template

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: "{Project Name} API"
  version: "1.0.0"
  description: |
    RESTful API cho {Project Name}.

    ## Authentication
    Tất cả endpoints (trừ `/auth/login`, `/auth/register`) yêu cầu
    JWT Bearer token trong Authorization header.

    ```
    Authorization: Bearer <access_token>
    ```

    Access token hết hạn sau 15 phút. Sử dụng refresh token để lấy token mới.

    ## Rate Limiting
    - Public endpoints: 20 requests/minute
    - Authenticated endpoints: 100 requests/minute
    - Admin endpoints: 1000 requests/minute

    Headers trả về:
    - `X-RateLimit-Limit`: Maximum requests per window
    - `X-RateLimit-Remaining`: Remaining requests in current window
    - `X-RateLimit-Reset`: Unix timestamp khi window reset

  contact:
    name: Tech Lead
    email: tech-lead@company.com

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging
  - url: http://localhost:3000/api/v1
    description: Development

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    # Reusable schemas
    PaginatedResponse:
      type: object
      properties:
        data:
          type: array
        meta:
          type: object
          properties:
            total: { type: integer }
            page: { type: integer }
            limit: { type: integer }
            totalPages: { type: integer }

    ErrorResponse:
      type: object
      required: [error, message]
      properties:
        error:
          type: string
          example: "VALIDATION_ERROR"
        message:
          type: string
          example: "One or more fields are invalid"
        details:
          type: array
          items:
            type: object
            properties:
              field: { type: string }
              message: { type: string }

    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [user, admin]
        createdAt:
          type: string
          format: date-time
          readOnly: true

paths:
  /users:
    get:
      summary: Danh sách users với phân trang
      description: |
        Trả về danh sách users. Chỉ admin mới có thể gọi endpoint này.

        Kết quả được sắp xếp theo `createdAt` giảm dần (mới nhất trước).
      operationId: listUsers
      tags: [Users]
      security:
        - BearerAuth: []
      parameters:
        - name: page
          in: query
          schema: { type: integer, minimum: 1, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
        - name: search
          in: query
          description: Search theo name hoặc email (case-insensitive)
          schema: { type: string, maxLength: 100 }
      responses:
        '200':
          description: Danh sách users
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/PaginatedResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/User'
        '401':
          description: Chưa xác thực
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ErrorResponse' }
        '403':
          description: Không có quyền (chỉ admin)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ErrorResponse' }
```

