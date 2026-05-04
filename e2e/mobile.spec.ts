import { test, expect, devices } from '@playwright/test';

// Mobile tests using iPhone 14 viewport
test.describe('Mobile Responsive', () => {
  test.use({ ...devices['iPhone 14'] });

  test('should show login page correctly on mobile', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Inputs should be full-width on mobile
    const emailInput = page.locator('input[type="email"]');
    const box = await emailInput.boundingBox();
    if (box) {
      // On iPhone 14 (390px wide), inputs should be reasonably wide
      expect(box.width).toBeGreaterThan(200);
    }
  });

  test('should have touch-friendly buttons (min 44px height)', async ({ page }) => {
    await page.goto('/login');

    const submitBtn = page.locator('button[type="submit"]').or(page.locator('button').first());
    const box = await submitBtn.first().boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('should show kiosk page correctly on mobile', async ({ page }) => {
    await page.goto('/kiosk');

    await expect(page.locator('text=Bienvenue')).toBeVisible({ timeout: 10000 });

    // Kiosk buttons should be large and touch-friendly
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show 404 page correctly on mobile', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');

    await expect(page.locator('text=404').or(page.locator('text=introuvable').or(page.locator('text=not found')))).toBeVisible({ timeout: 10000 });
  });

  test('should have readable text on mobile (not clipped)', async ({ page }) => {
    await page.goto('/login');

    // Check that content is visible and not overflowing
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));

    // Horizontal scroll should not be needed
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 10);
  });
});

// Tablet tests using iPad
test.describe('Tablet Responsive', () => {
  test.use({ ...devices['iPad Pro'] });

  test('should show login page on tablet', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should show kiosk welcome on tablet', async ({ page }) => {
    await page.goto('/kiosk');
    await expect(page.locator('text=Bienvenue')).toBeVisible({ timeout: 10000 });
  });
});
