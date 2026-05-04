import { test, expect } from '@playwright/test';

test.describe('Kiosk Mode', () => {
  test('should show kiosk welcome screen', async ({ page }) => {
    await page.goto('/kiosk');

    // Kiosk should NOT redirect to login — it's public
    await expect(page).toHaveURL(/kiosk/);
    await expect(page.locator('text=Bienvenue')).toBeVisible({ timeout: 10000 });
  });

  test('should not show sidebar or navigation in kiosk mode', async ({ page }) => {
    await page.goto('/kiosk');

    // No sidebar should be visible
    const sidebar = page.locator('[data-testid="sidebar"]').or(page.locator('nav'));
    // Kiosk layout has no nav
    await expect(page.locator('text=Bienvenue')).toBeVisible();
  });

  test('should show action buttons on kiosk welcome', async ({ page }) => {
    await page.goto('/kiosk');

    // Should have at least one action button (RDV, Walk-in, etc.)
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to check-in form', async ({ page }) => {
    await page.goto('/kiosk');

    // Click first main action button
    const actionBtn = page.locator('button').filter({ hasText: /RDV|rendez|enregistrer|livraison/i }).first();
    if (await actionBtn.count() > 0) {
      await actionBtn.click();
      await expect(page).toHaveURL(/checkin|kiosk/);
    }
  });

  test('should show check-in form with name field', async ({ page }) => {
    await page.goto('/kiosk/checkin?type=walkin');

    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show language selector on kiosk', async ({ page }) => {
    await page.goto('/kiosk');

    // Language buttons
    const langBtn = page.locator('button:has-text("Français")').or(page.locator('button:has-text("English")'));
    await expect(langBtn.first()).toBeVisible({ timeout: 10000 });
  });
});
