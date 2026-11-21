import { UsageError } from './errors.js';
import type { DateRange } from './pull-request-source.js';

export const DEFAULT_RANGE_DAYS = 90;
export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly', 'overall'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function validDate(text: string): string {
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== text) {
    throw new UsageError(`Invalid date "${text}". Use YYYY-MM-DD`);
  }
  return text;
}

export function resolveRange(since: string | undefined, until: string | undefined, now: Date): DateRange {
  const end = validDate(until ?? isoDate(now));
  const start = validDate(since ?? isoDate(new Date(Date.parse(`${end}T00:00:00Z`) - (DEFAULT_RANGE_DAYS - 1) * DAY_MS)));
  if (start > end) throw new UsageError(`--since ${start} is after --until ${end}`);
  return { since: start, until: end };
}
