import { test, expect } from '@playwright/test';

test.describe('Document Q&A — Public Routes', () => {
  test('should redirect /data to login when unauthenticated', async ({ page }) => {
    await page.goto('/data');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('should redirect /chat to login when unauthenticated', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});

test.describe('Document Q&A — Authenticated', () => {
  test.skip(!!process.env.SKIP_AUTH_TESTS, 'Skipping authenticated tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_EMAIL ?? 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? 'Test1234!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|home/, { timeout: 15000 });
  });

  test('should show document upload interface', async ({ page }) => {
    await page.goto('/data');

    const uploadArea = page.locator('input[type="file"]').or(
      page.locator('text=Déposer').or(page.locator('text=Upload'))
    );
    await expect(uploadArea.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show chat interface with input', async ({ page }) => {
    await page.goto('/chat');

    const chatInput = page.locator('textarea').or(
      page.locator('[data-testid="chat-input"]').or(page.locator('input[placeholder]'))
    );
    await expect(chatInput.first()).toBeVisible({ timeout: 10000 });
  });

  test('should be able to type in chat input', async ({ page }) => {
    await page.goto('/chat');

    const chatInput = page.locator('textarea').or(page.locator('input[placeholder]')).first();
    await chatInput.fill("Quel est notre chiffre d'affaires ?");
    await expect(chatInput).not.toBeEmpty();
  });

  test('should show document list', async ({ page }) => {
    await page.goto('/data');

    // Either documents are listed or an empty state is shown
    const content = page.locator('main, [data-testid="documents"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});
