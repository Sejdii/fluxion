import { UsageError } from './errors.js';
import { isoDate } from './dates.js';
import type { DateRange } from './pull-request-source.js';

export const DEFAULT_RANGE_DAYS = 90;
export const DAILY_RANGE_DAYS = 30;
export const MONTHLY_RANGE_MONTHS = 12;
export const YEARLY_RANGE_YEARS = 4;
export const DAY_PERIOD_MAX_MONTHS = 12;
export const EARLIEST_DATE = '2008-01-01';
export const PERIODS = ['daily', 'weekly', 'monthly', 'yearly', 'overall'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(text: string): string {
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== text) {
    throw new UsageError(`Invalid date "${text}". Use YYYY-MM-DD`);
  }
  return text;
}

function defaultStart(period: string, end: string): string {
  const last = new Date(`${end}T00:00:00Z`);
  if (period === 'overall') return EARLIEST_DATE;
  if (period === 'yearly') return isoDate(new Date(Date.UTC(last.getUTCFullYear() - (YEARLY_RANGE_YEARS - 1), 0, 1)));
  if (period === 'monthly') return isoDate(new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - (MONTHLY_RANGE_MONTHS - 1), 1)));
  const days = period === 'daily' ? DAILY_RANGE_DAYS : DEFAULT_RANGE_DAYS;
  return isoDate(new Date(last.getTime() - (days - 1) * DAY_MS));
}

export function resolveRange(period: string, since: string | undefined, until: string | undefined, now: Date): DateRange {
  const end = validDate(until ?? isoDate(now));
  const start = validDate(since ?? defaultStart(period, end));
  if (start > end) throw new UsageError(`--since ${start} is after --until ${end}`);
  return { since: start, until: end };
}

export function previousRangeOf(range: DateRange): DateRange {
  const since = new Date(`${range.since}T00:00:00Z`).getTime();
  const days = (new Date(`${range.until}T00:00:00Z`).getTime() - since) / DAY_MS + 1;
  return { since: isoDate(new Date(since - days * DAY_MS)), until: isoDate(new Date(since - DAY_MS)) };
}

export function exceedsDayPeriodLimit(range: DateRange): boolean {
  const start = new Date(`${range.since}T00:00:00Z`);
  const limit = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + DAY_PERIOD_MAX_MONTHS, start.getUTCDate()));
  return isoDate(limit) <= range.until;
}
