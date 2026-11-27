import { expect, test } from 'vitest';
import { loadThreshold, saveThreshold } from '../src/threshold-storage.js';

function memory(initial?: string) {
  const items = new Map<string, string>(initial === undefined ? [] : [['fluxion.largeLoadThreshold', initial]]);
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

test('aSavedThresholdComesBack', () => {
  const storage = memory();

  saveThreshold(storage, 1500);

  expect(loadThreshold(storage)).toBe(1500);
});

test.each([[undefined], [''], ['0'], ['-5'], ['2.5'], ['many']])('aMissingOrInvalidStoredThresholdMeansNoChoice%#', (stored) => {
  expect(loadThreshold(memory(stored))).toBeUndefined();
});

test('unavailableStorageMeansNoChoice', () => {
  expect(loadThreshold(undefined)).toBeUndefined();
});
