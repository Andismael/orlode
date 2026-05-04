import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page with all required elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]').or(page.locator('button:has-text("Connexion")').or(page.locator('button:has-text("Se connecter")')))).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'notexist@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Wait for error message
    await expect(
      page.locator('text=invalide').or(page.locator('text=incorrect').or(page.locator('text=Identifiants')))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');

    const forgotLink = page.locator('a:has-text("mot de passe")').or(page.locator('a:has-text("Forgot")').or(page.locator('text=Oublié')));
    if (await forgotLink.count() > 0) {
      await forgotLink.first().click();
      await expect(page).toHaveURL(/forgot|reset/, { timeout: 5000 });
    } else {
      await page.goto('/forgot-password');
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test('should show register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
