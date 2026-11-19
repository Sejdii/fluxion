import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'pnpm exec vite preview --config packages/web/vite.config.ts --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
  use: { baseURL: 'http://localhost:4173' },
});
