import type { ComparisonMode } from '@fluxion/core';
import { COMPARISON_MODES } from './query.js';

const KEY = 'fluxion.compare';

type Stored = Pick<Storage, 'getItem' | 'setItem'>;

export function loadComparisonMode(storage: Stored | undefined): ComparisonMode | undefined {
  try {
    const stored = storage?.getItem(KEY);
    return COMPARISON_MODES.find((mode) => mode === stored);
  } catch {
    return undefined;
  }
}

export function saveComparisonMode(storage: Stored | undefined, mode: ComparisonMode): void {
  try {
    storage?.setItem(KEY, mode);
  } catch {
    return;
  }
}
