import { isValidThreshold } from './query.js';

const KEY = 'fluxion.largeLoadThreshold';

type Stored = Pick<Storage, 'getItem' | 'setItem'>;

export function loadThreshold(storage: Stored | undefined): number | undefined {
  try {
    const threshold = Number(storage?.getItem(KEY));
    return isValidThreshold(threshold) ? threshold : undefined;
  } catch {
    return undefined;
  }
}

export function saveThreshold(storage: Stored | undefined, threshold: number): void {
  try {
    storage?.setItem(KEY, String(threshold));
  } catch {
    return;
  }
}
