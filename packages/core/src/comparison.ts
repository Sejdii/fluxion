import { DataError, UsageError } from './errors.js';

const COMPARISON_MODES = ['auto', 'always', 'never'] as const;
const DEFAULT_LARGE_LOAD_THRESHOLD = 500;

export type ComparisonMode = (typeof COMPARISON_MODES)[number];

export type ComparisonSkip = { skipped: 'turnedOff' } | { skipped: 'largeLoad'; threshold: number } | { skipped: 'countUnavailable' };

function isComparisonMode(text: string): text is ComparisonMode {
  return (COMPARISON_MODES as readonly string[]).includes(text);
}

export function parseComparisonMode(text: string): ComparisonMode {
  if (!isComparisonMode(text)) throw new UsageError(`Unknown comparison mode "${text}". Use ${COMPARISON_MODES.join(', ')}`);
  return text;
}

export function parseLargeLoadThreshold(text: string): number {
  const threshold = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(threshold) || threshold < 1) {
    throw new UsageError(`Invalid large load threshold "${text}". Use a whole number of at least 1`);
  }
  return threshold;
}

async function largeLoadSkipOf(threshold: number, countSelected: () => Promise<number>): Promise<ComparisonSkip | null> {
  try {
    return (await countSelected()) > threshold ? { skipped: 'largeLoad', threshold } : null;
  } catch (error) {
    if (error instanceof DataError) return { skipped: 'countUnavailable' };
    throw error;
  }
}

export async function comparisonSkipOf(mode: ComparisonMode, countSelected: () => Promise<number>, threshold = DEFAULT_LARGE_LOAD_THRESHOLD): Promise<ComparisonSkip | null> {
  if (mode === 'never') return { skipped: 'turnedOff' };
  return mode === 'auto' ? largeLoadSkipOf(threshold, countSelected) : null;
}
