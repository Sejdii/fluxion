export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Range {
  since: string;
  until: string;
}

export interface Query extends Range {
  repos: string[];
  period: Period;
}

const DEFAULT_MONTHS = 12;
const DATE_LENGTH = 10;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, DATE_LENGTH);
}

export function defaultQuery(repos: string[], today: Date): Query {
  const since = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (DEFAULT_MONTHS - 1), 1));
  return { repos, since: isoDate(since), until: isoDate(today), period: 'monthly' };
}

export function queryKey(query: Query): string {
  return [[...query.repos].sort().join(','), query.since, query.until, query.period].join('|');
}

export function selectionKey(query: Query): string {
  return queryKey({ ...query, period: 'monthly' });
}

export function queryString(query: Query, refresh: boolean): string {
  const params = new URLSearchParams({ repos: query.repos.join(','), since: query.since, until: query.until, period: query.period });
  if (refresh) params.set('refresh', 'true');
  return params.toString();
}

export function isDayPeriodAllowed(range: Range, maxMonths: number): boolean {
  const start = new Date(`${range.since}T00:00:00Z`);
  const limit = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + maxMonths, start.getUTCDate()));
  return isoDate(limit) > range.until;
}

export function applyChoice(query: Query, maxMonths: number): Query {
  return query.period === 'daily' && !isDayPeriodAllowed(query, maxMonths) ? { ...query, period: 'weekly' } : query;
}

// Mirrors EARLIEST_DATE in core; web may only import types from core.
const EARLIEST_YEAR = 2008;
const YEAR_LENGTH = 4;

export function yearChoices(today: Date): number[] {
  return Array.from({ length: today.getUTCFullYear() - EARLIEST_YEAR + 1 }, (_, index) => EARLIEST_YEAR + index);
}

export function yearRange(fromYear: number, toYear: number, today: Date): Range {
  const until = toYear >= today.getUTCFullYear() ? isoDate(today) : `${toYear}-12-31`;
  return { since: `${fromYear}-01-01`, until };
}

export function yearOf(date: string): number {
  return Number(date.slice(0, YEAR_LENGTH));
}

export function snapToYears(range: Range, today: Date): Range {
  return yearRange(yearOf(range.since), yearOf(range.until), today);
}
