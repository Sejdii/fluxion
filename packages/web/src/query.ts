import type { Weekday, WorkSchedule } from '@fluxion/core';

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Range {
  since: string;
  until: string;
}

export interface Query extends Range {
  repos: string[];
  period: Period;
  /** undefined: the server's own schedule; null: no schedule; otherwise the schedule to apply. */
  workSchedule?: WorkSchedule | null;
}

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultSchedule(): WorkSchedule {
  return { days: WEEKDAYS.slice(0, 5), start: '09:00', end: '17:00', timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone };
}

export function isValidSchedule(schedule: WorkSchedule | null | undefined): boolean {
  return !schedule || (schedule.days.length > 0 && schedule.start !== '' && schedule.end !== '' && schedule.start < schedule.end && schedule.timeZone !== '');
}

export function scheduleKey(schedule: WorkSchedule | null | undefined): string {
  return schedule === undefined ? 'server' : schedule === null ? 'off' : [schedule.days.join(','), schedule.start, schedule.end, schedule.timeZone].join(' ');
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
  return [[...query.repos].sort().join(','), query.since, query.until, query.period, scheduleKey(query.workSchedule)].join('|');
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
