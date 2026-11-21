import { UsageError } from './errors.js';
import type { DateRange } from './pull-request-source.js';

export const DEFAULT_RANGE_DAYS = 90;
export const PERIODS = ['monthly'] as const;

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

/** Every UTC month, as `YYYY-MM`, that the range touches. */
export function monthLabelsOf(range: DateRange): string[] {
  const months: string[] = [];
  let year = Number(range.since.slice(0, 4));
  let month = Number(range.since.slice(5, 7));
  const last = range.until.slice(0, 7);
  for (;;) {
    const label = `${year}-${String(month).padStart(2, '0')}`;
    months.push(label);
    if (label === last) return months;
    year += month === 12 ? 1 : 0;
    month = month === 12 ? 1 : month + 1;
  }
}
