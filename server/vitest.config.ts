import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/__tests__/**'],
    },
    testTimeout: 30000,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**', 'node_modules'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
