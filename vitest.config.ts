import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['packages/core/**/*.test.ts'] } },
      { test: { name: 'adapters', include: ['packages/adapters/**/*.test.ts'] } },
      { test: { name: 'cli', include: ['packages/cli/**/*.test.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/core/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { 100: true },
    },
  },
});
