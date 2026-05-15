# Testing: k6 performance & accessibility

> Lazy reference — [SKILL.md](../SKILL.md)

## 5. Performance Testing với k6

### 5.1 Load Test Script

```javascript
// tests/performance/load-test.js
import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Rate, Trend, Gauge } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'

// Custom metrics
const errorRate = new Rate('errors')
const authDuration = new Trend('auth_duration', true)
const apiDuration = new Trend('api_duration', true)

// Test configuration
export const options = {
  scenarios: {
    // Ramp-up test: gradually increase load
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Warm up
        { duration: '5m', target: 100 },  // Normal load
        { duration: '2m', target: 200 },  // Peak load
        { duration: '5m', target: 200 },  // Sustain peak
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },
    // Spike test: sudden traffic spike
    spike: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '10s', target: 500 },  // Spike!
        { duration: '1m', target: 500 },   // Sustain spike
        { duration: '10s', target: 50 },   // Return to normal
      ],
    },
  },
  thresholds: {
    http_req_duration: [
      'p(50)<100',   // Median < 100ms
      'p(95)<500',   // 95th < 500ms
      'p(99)<1000',  // 99th < 1 second
    ],
    http_req_failed: ['rate<0.01'],  // Error rate < 1%
    errors: ['rate<0.01'],
    auth_duration: ['p(95)<300'],
    api_duration: ['p(95)<200'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://staging.example.com'

function getAuthToken() {
  const response = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: `user${__VU}@test.com`,
    password: 'TestPass123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  })

  authDuration.add(response.timings.duration)

  if (!check(response, { 'login status 200': (r) => r.status === 200 })) {
    errorRate.add(1)
    return null
  }

  errorRate.add(0)
  return JSON.parse(response.body).accessToken
}

export default function() {
  const token = getAuthToken()
  if (!token) return

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  group('User operations', () => {
    // GET user profile
    const profileRes = http.get(`${BASE_URL}/api/v1/users/me`, { headers })
    apiDuration.add(profileRes.timings.duration)
    check(profileRes, {
      'GET profile 200': (r) => r.status === 200,
      'GET profile < 200ms': (r) => r.timings.duration < 200,
    })
    errorRate.add(profileRes.status !== 200 ? 1 : 0)

    sleep(1)

    // GET paginated list
    const listRes = http.get(`${BASE_URL}/api/v1/products?page=1&limit=20`, { headers })
    apiDuration.add(listRes.timings.duration)
    check(listRes, {
      'GET products 200': (r) => r.status === 200,
      'GET products < 500ms': (r) => r.timings.duration < 500,
      'GET products has data': (r) => {
        const body = JSON.parse(r.body)
        return body.data && body.data.length > 0
      },
    })

    sleep(1)
  })
}

export function handleSummary(data) {
  return {
    'performance-report.html': htmlReport(data),
    'performance-summary.json': JSON.stringify(data),
  }
}
```

## 6. Accessibility Testing

### 6.1 axe-core Integration (Playwright)

```typescript
// tests/accessibility/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Audit', () => {
  test('TC-A11Y-001: Login page has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/login')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Report violations in readable format
    if (results.violations.length > 0) {
      const violations = results.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => n.html).slice(0, 3),
      }))
      console.log('Accessibility violations:', JSON.stringify(violations, null, 2))
    }

    expect(results.violations).toHaveLength(0)
  })

  test('TC-A11Y-002: Dashboard page has no critical violations', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[name=email]', 'test@example.com')
    await page.fill('[name=password]', 'password')
    await page.click('[type=submit]')
    await page.waitForURL(/\/dashboard/)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('#third-party-widget')  // Exclude known 3rd party issues
      .analyze()

    // Only fail on critical and serious violations
    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    )

    expect(criticalViolations).toHaveLength(0)
  })
})
```

### 6.2 Manual A11y Checklist

```markdown
## Accessibility Manual Test Checklist

### Keyboard Navigation
- [ ] Tab qua tất cả interactive elements theo logical order
- [ ] Shift+Tab reverse navigation hoạt động
- [ ] Enter/Space kích hoạt buttons và links
- [ ] Escape đóng modals/dropdowns
- [ ] Arrow keys navigate trong menus, carousels, tabs
- [ ] Không có keyboard traps (phải có escape path)

### Screen Reader Testing (VoiceOver/NVDA)
- [ ] Page title meaningful và unique
- [ ] Heading hierarchy logical (h1 → h2 → h3)
- [ ] Images có meaningful alt text
- [ ] Forms: labels, error messages được announce
- [ ] Dynamic content changes được announce (alerts, loading)
- [ ] Table headers với scope attributes

### Visual
- [ ] Focus indicator clearly visible (2px+ outline)
- [ ] Color contrast passes:
      - Normal text: >= 4.5:1
      - Large text (18pt+): >= 3:1
      - UI components: >= 3:1
- [ ] Không chỉ rely on color để convey information
- [ ] Text có thể scale tới 200% không mất content
```

