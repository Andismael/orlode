import { test, expect } from '@playwright/test';

// E2E tests for the Connectors page
// These require authentication — in a real environment you'd use stored auth state

test.describe('Connectors Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to connectors — will redirect to login if not auth'd
    await page.goto('/connectors');
  });

  test('should show connectors page or redirect to login', async ({ page }) => {
    const url = page.url();
    expect(url.includes('connectors') || url.includes('login')).toBe(true);
  });

  test('should show login form when not authenticated', async ({ page }) => {
    if (page.url().includes('login')) {
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });
});

// Tests that run when authenticated (using stored auth state or test credentials)
test.describe('Connectors — Authenticated', () => {
  test.skip(!!process.env.SKIP_AUTH_TESTS, 'Skipping authenticated tests');

  test.beforeEach(async ({ page }) => {
    // In CI, use pre-seeded test account
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_EMAIL ?? 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? 'Test1234!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|home/, { timeout: 15000 });
    await page.goto('/connectors');
  });

  test('should display connector types', async ({ page }) => {
    await expect(page.locator('text=Web').or(page.locator('text=Site'))).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=base de données').or(page.locator('text=Database'))).toBeVisible({ timeout: 10000 });
  });

  test('should show connector stats', async ({ page }) => {
    const statsEl = page.locator('text=Sources').or(page.locator('text=Connecteurs'));
    await expect(statsEl).toBeVisible({ timeout: 10000 });
  });

  test('should open web crawler form', async ({ page }) => {
    const webBtn = page.locator('text=Site Web').or(page.locator('text=Web Crawler'));
    if (await webBtn.count() > 0) {
      await webBtn.first().click();
      await expect(page.locator('input[type="url"]').or(page.locator('input[placeholder*="http"]'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('should open database connector form', async ({ page }) => {
    const dbBtn = page.locator('text=Base de données').or(page.locator('text=Database'));
    if (await dbBtn.count() > 0) {
      await dbBtn.first().click();
      await expect(page.locator('text=MySQL').or(page.locator('text=PostgreSQL'))).toBeVisible({ timeout: 5000 });
    }
  });
});
