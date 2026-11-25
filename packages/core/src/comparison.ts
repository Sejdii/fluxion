import { UsageError } from './errors.js';

const COMPARISON_MODES = ['always', 'never'] as const;

export type ComparisonMode = (typeof COMPARISON_MODES)[number];

export interface ComparisonSkip {
  skipped: 'turnedOff';
}

function isComparisonMode(text: string): text is ComparisonMode {
  return (COMPARISON_MODES as readonly string[]).includes(text);
}

export function parseComparisonMode(text: string): ComparisonMode {
  if (!isComparisonMode(text)) throw new UsageError(`Unknown comparison mode "${text}". Use ${COMPARISON_MODES.join(', ')}`);
  return text;
}
