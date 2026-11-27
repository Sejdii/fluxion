import { DataError, UsageError } from './errors.js';

const COMPARISON_MODES = ['auto', 'always', 'never'] as const;
const LARGE_LOAD_THRESHOLD = 500;

export type ComparisonMode = (typeof COMPARISON_MODES)[number];

export type ComparisonSkip = { skipped: 'turnedOff' } | { skipped: 'largeLoad'; threshold: number } | { skipped: 'countUnavailable' };

function isComparisonMode(text: string): text is ComparisonMode {
  return (COMPARISON_MODES as readonly string[]).includes(text);
}

export function parseComparisonMode(text: string): ComparisonMode {
  if (!isComparisonMode(text)) throw new UsageError(`Unknown comparison mode "${text}". Use ${COMPARISON_MODES.join(', ')}`);
  return text;
}

async function largeLoadSkipOf(countSelected: () => Promise<number>): Promise<ComparisonSkip | null> {
  try {
    return (await countSelected()) > LARGE_LOAD_THRESHOLD ? { skipped: 'largeLoad', threshold: LARGE_LOAD_THRESHOLD } : null;
  } catch (error) {
    if (error instanceof DataError) return { skipped: 'countUnavailable' };
    throw error;
  }
}

export async function comparisonSkipOf(mode: ComparisonMode, countSelected: () => Promise<number>): Promise<ComparisonSkip | null> {
  if (mode === 'never') return { skipped: 'turnedOff' };
  return mode === 'auto' ? largeLoadSkipOf(countSelected) : null;
}
