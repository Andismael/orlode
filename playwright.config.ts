import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['html']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: [
    {
      command: 'cd client && npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'cd server && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
