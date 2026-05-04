import { test, expect } from '@playwright/test';

test.describe('Admin Pages — Public Access Check', () => {
  test('should redirect /admin to login when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should redirect /admin/users to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should redirect /admin/billing to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/billing');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});

test.describe('Admin Pages — Authenticated Admin', () => {
  test.skip(!!process.env.SKIP_AUTH_TESTS, 'Skipping authenticated tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.ADMIN_EMAIL ?? 'admin@example.com');
    await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD ?? 'Admin1234!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|home/, { timeout: 15000 });
  });

  test('should access company settings page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should access user management page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(
      page.locator('text=Inviter').or(page.locator('text=Utilisateurs'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should access API keys page', async ({ page }) => {
    await page.goto('/admin/api-keys');
    await expect(
      page.locator('text=Gemini').or(page.locator('text=API'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should access billing page', async ({ page }) => {
    await page.goto('/admin/billing');
    await expect(
      page.locator('text=Plan').or(page.locator('text=Facturation'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should access skills manager', async ({ page }) => {
    await page.goto('/admin/skills');
    await expect(
      page.locator('text=Skills').or(page.locator('text=Compétences'))
    ).toBeVisible({ timeout: 10000 });
  });
});
