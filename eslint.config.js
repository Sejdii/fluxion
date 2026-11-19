import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const limits = {
  'max-lines-per-function': ['error', 30],
  'max-lines': ['error', 300],
  'max-params': ['error', 4],
  'max-depth': ['error', 3],
  complexity: ['error', 10],
};

export default tseslint.config(
  { ignores: ['**/dist/**', 'coverage/**', 'test-results/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.ts'], rules: limits },
  { files: ['**/*.cjs'], languageOptions: { globals: globals.node } },
  {
    files: ['packages/web/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
);
