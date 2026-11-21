import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

const limits = {
  'max-lines-per-function': ['error', 30],
  'max-lines': ['error', 300],
  'max-params': ['error', 4],
  'max-depth': ['error', 3],
  complexity: ['error', 10],
};

export default defineConfig(
  { ignores: ['**/dist/**', 'coverage/**', 'test-results/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], rules: limits },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { '@typescript-eslint/no-deprecated': 'error' },
  },
  { files: ['**/*.cjs'], languageOptions: { globals: globals.node } },
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
);
