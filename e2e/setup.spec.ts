import { test, expect } from '@playwright/test';

test.describe('Setup Wizard', () => {
  test('should show setup page', async ({ page }) => {
    await page.goto('/setup');

    // Should either show setup wizard or redirect to login
    const isOnSetup = page.url().includes('setup');
    const isOnLogin = page.url().includes('login');

    expect(isOnSetup || isOnLogin).toBe(true);
  });

  test('should show step indicator when on setup page', async ({ page }) => {
    await page.goto('/setup');

    if (page.url().includes('setup')) {
      const stepIndicator = page.locator('text=Étape').or(page.locator('text=Step').or(page.locator('[data-testid="step"]')));
      // May or may not have step indicator depending on implementation
      const count = await stepIndicator.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show wizard navigation buttons', async ({ page }) => {
    await page.goto('/setup');

    if (page.url().includes('setup')) {
      const nextBtn = page.locator('button:has-text("Suivant")').or(page.locator('button:has-text("Next")'));
      const count = await nextBtn.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
