import type { ComparisonMode } from '@fluxion/core';
import { COMPARISON_CHOICES, DEFAULT_COMPARISON } from './query.js';

const KEY = 'fluxion.compare';

type Stored = Pick<Storage, 'getItem' | 'setItem'>;

export function loadComparisonMode(storage: Stored | undefined): ComparisonMode {
  try {
    const stored = storage?.getItem(KEY);
    return COMPARISON_CHOICES.find(({ value }) => value === stored)?.value ?? DEFAULT_COMPARISON;
  } catch {
    return DEFAULT_COMPARISON;
  }
}

export function saveComparisonMode(storage: Stored | undefined, mode: ComparisonMode): void {
  try {
    storage?.setItem(KEY, mode);
  } catch {
    return;
  }
}
