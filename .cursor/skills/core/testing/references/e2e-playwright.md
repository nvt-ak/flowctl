# Testing: E2E Playwright

> Lazy reference — [SKILL.md](../SKILL.md)

## 4. E2E Testing với Playwright

### 4.1 Page Object Model Setup

```typescript
// tests/e2e/pages/BasePage.ts
export abstract class BasePage {
  constructor(protected page: Page) {}

  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png` })
  }
}

// tests/e2e/pages/LoginPage.ts
export class LoginPage extends BasePage {
  private emailInput = () => this.page.getByLabel('Email')
  private passwordInput = () => this.page.getByLabel('Mật khẩu')
  private submitButton = () => this.page.getByRole('button', { name: 'Đăng nhập' })
  private errorMessage = () => this.page.getByRole('alert')

  async navigate() {
    await this.page.goto('/login')
    await this.waitForLoaded()
  }

  async login(email: string, password: string) {
    await this.emailInput().fill(email)
    await this.passwordInput().fill(password)
    await this.submitButton().click()
  }

  async getErrorMessage() {
    return this.errorMessage().textContent()
  }

  async isOnPage() {
    return this.page.url().includes('/login')
  }
}

// tests/e2e/pages/DashboardPage.ts
export class DashboardPage extends BasePage {
  async isOnPage() {
    return this.page.url().includes('/dashboard')
  }

  async getWelcomeMessage() {
    return this.page.getByTestId('welcome-message').textContent()
  }
}
```

### 4.2 E2E Test Implementation

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

// Fixtures
const TEST_USER = {
  email: 'testuser@example.com',
  password: 'TestPass123!',
  name: 'Test User',
}

test.describe('Authentication Flow', () => {
  test.describe('Login', () => {

    test('TC-E2E-001: Successful login redirects to dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigate()
      await loginPage.login(TEST_USER.email, TEST_USER.password)

      await expect(page).toHaveURL(/\/dashboard/)
      await expect(dashboardPage.isOnPage()).resolves.toBe(true)
    })

    test('TC-E2E-002: Failed login shows error message', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigate()
      await loginPage.login('wrong@email.com', 'wrongpassword')

      const error = await loginPage.getErrorMessage()
      expect(error).toContain('Email hoặc mật khẩu không đúng')
      await expect(loginPage.isOnPage()).resolves.toBe(true)
    })

    test('TC-E2E-003: Empty form validation', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigate()
      await page.getByRole('button', { name: 'Đăng nhập' }).click()

      await expect(page.getByText('Email không được để trống')).toBeVisible()
      await expect(page.getByText('Mật khẩu không được để trống')).toBeVisible()
    })

    test('TC-E2E-004: Login form accessible via keyboard', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigate()

      // Tab đến email input
      await page.keyboard.press('Tab')
      await expect(page.getByLabel('Email')).toBeFocused()

      // Tab đến password
      await page.keyboard.press('Tab')
      await expect(page.getByLabel('Mật khẩu')).toBeFocused()

      // Tab đến submit button
      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeFocused()

      // Press Enter to submit
      await page.getByLabel('Email').fill(TEST_USER.email)
      await page.getByLabel('Mật khẩu').fill(TEST_USER.password)
      await page.getByRole('button', { name: 'Đăng nhập' }).press('Enter')

      await expect(page).toHaveURL(/\/dashboard/)
    })
  })

  test.describe('Logout', () => {

    test.beforeEach(async ({ page }) => {
      // Login first
      const loginPage = new LoginPage(page)
      await loginPage.navigate()
      await loginPage.login(TEST_USER.email, TEST_USER.password)
      await expect(page).toHaveURL(/\/dashboard/)
    })

    test('TC-E2E-005: Logout clears session', async ({ page }) => {
      await page.getByRole('button', { name: 'Đăng xuất' }).click()

      await expect(page).toHaveURL(/\/login/)

      // Try to navigate to protected route
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)  // Should redirect back to login
    })
  })
})
```

### 4.3 Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['allure-playwright'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
})
```

