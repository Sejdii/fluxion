import type { ComparisonMode, Weekday, WorkSchedule } from '@fluxion/core';

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ScheduleChoice = WorkSchedule | null | undefined;

export interface Range {
  since: string;
  until: string;
}

export interface Query extends Range {
  repos: string[];
  period: Period;
  workSchedule?: ScheduleChoice;
  compare?: ComparisonMode | undefined;
  largeLoadThreshold?: number | undefined;
}

export const COMPARISON_LABELS: Record<ComparisonMode, string> = { auto: 'Auto', always: 'Always', never: 'Never' };
export const COMPARISON_MODES = Object.keys(COMPARISON_LABELS) as ComparisonMode[];
export const DEFAULT_COMPARISON: ComparisonMode = 'auto';

export const DEFAULT_LARGE_LOAD_THRESHOLD = 500;

export function isValidThreshold(threshold: number): boolean {
  return Number.isSafeInteger(threshold) && threshold >= 1;
}

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultSchedule(): WorkSchedule {
  return { days: WEEKDAYS.slice(0, 5), start: '09:00', end: '17:00', timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone };
}

export function isValidSchedule(schedule: ScheduleChoice): boolean {
  return !schedule || (schedule.days.length > 0 && schedule.start !== '' && schedule.end !== '' && schedule.start < schedule.end && schedule.timeZone !== '');
}

export function scheduleKey(schedule: ScheduleChoice): string {
  return schedule === undefined ? 'server' : schedule === null ? 'off' : [schedule.days.join(','), schedule.start, schedule.end, schedule.timeZone].join(' ');
}

const DEFAULT_MONTHS = 12;
const DATE_LENGTH = 10;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, DATE_LENGTH);
}

export const SHORT_DEFAULT_MONTHS = 3;

export function defaultQuery(repos: string[], today: Date, months = DEFAULT_MONTHS): Query {
  const since = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1));
  return { repos, since: isoDate(since), until: isoDate(today), period: 'monthly' };
}

export interface Starting {
  query: Query;
  notice: string | null;
}

export function startingQuery(repos: string[], today: Date, count: number | null, largeLoadThreshold = DEFAULT_LARGE_LOAD_THRESHOLD): Starting {
  if (count === null || count <= largeLoadThreshold) return { query: defaultQuery(repos, today), notice: null };
  const notice = `The last ${DEFAULT_MONTHS} months hold ${count.toLocaleString('en-US')} merged PRs, which would be slow to load. Showing the last ${SHORT_DEFAULT_MONTHS} months instead. Pick a longer range to load more.`;
  return { query: defaultQuery(repos, today, SHORT_DEFAULT_MONTHS), notice };
}

export function countQueryString(query: Query): string {
  return new URLSearchParams({ repos: query.repos.join(','), since: query.since, until: query.until }).toString();
}

export function queryKey(query: Query): string {
  return [[...query.repos].sort().join(','), query.since, query.until, query.period, scheduleKey(query.workSchedule), query.compare ?? DEFAULT_COMPARISON, query.largeLoadThreshold ?? DEFAULT_LARGE_LOAD_THRESHOLD].join('|');
}

export function selectionKey(query: Query): string {
  return queryKey({ ...query, period: 'monthly' });
}

export function queryString(query: Query, refresh: boolean): string {
  const params = new URLSearchParams({ repos: query.repos.join(','), since: query.since, until: query.until, period: query.period });
  const schedule = query.workSchedule;
  if (schedule === null) params.set('workSchedule', 'off');
  if (schedule) {
    params.set('workDays', schedule.days.join(','));
    params.set('workHours', `${schedule.start}-${schedule.end}`);
    params.set('timezone', schedule.timeZone);
  }
  if (query.compare) params.set('compare', query.compare);
  if (query.largeLoadThreshold !== undefined) params.set('largeLoadThreshold', String(query.largeLoadThreshold));
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

const EARLIEST_SUPPORTED_YEAR = 2008;
const YEAR_PREFIX_LENGTH = 4;

export function yearChoices(today: Date): number[] {
  return Array.from({ length: today.getUTCFullYear() - EARLIEST_SUPPORTED_YEAR + 1 }, (_, index) => EARLIEST_SUPPORTED_YEAR + index);
}

export function yearRange(fromYear: number, toYear: number, today: Date): Range {
  const until = toYear >= today.getUTCFullYear() ? isoDate(today) : `${toYear}-12-31`;
  return { since: `${fromYear}-01-01`, until };
}

function yearOf(date: string): number {
  return Number(date.slice(0, YEAR_PREFIX_LENGTH));
}

export function yearsOf(range: Range): { from: number; to: number } {
  return { from: yearOf(range.since), to: yearOf(range.until) };
}

export function snapToYears(range: Range, today: Date): Range {
  const { from, to } = yearsOf(range);
  return yearRange(from, to, today);
}
