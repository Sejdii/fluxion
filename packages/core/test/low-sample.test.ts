import { expect, test } from 'vitest';
import { isLowSample } from '../src/index.js';

test('periodWithFewerThanFiveMergedPrsIsLowSample', () => {
  const merged = 4;

  const result = isLowSample(merged);

  expect(result).toBe(true);
});

test('periodWithFiveMergedPrsIsNotLowSample', () => {
  const merged = 5;

  const result = isLowSample(merged);

  expect(result).toBe(false);
});
