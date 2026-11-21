import { PERIODS } from './range.js';
import type { DateRange, PullRequestActivity } from './pull-request-source.js';

export const OVERALL_LABEL = 'overall';

export interface PeriodBucket {
  label: string;
  pullRequests: PullRequestActivity[];
  inProgress: boolean;
}

type Calendar = Exclude<(typeof PERIODS)[number], typeof OVERALL_LABEL>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const MONDAY_OFFSET = 6;

function utcDay(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

function startOf(calendar: Calendar, day: Date): Date {
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  if (calendar === 'yearly') return new Date(Date.UTC(year, 0, 1));
  if (calendar === 'monthly') return new Date(Date.UTC(year, month, 1));
  if (calendar === 'weekly') return new Date(day.getTime() - ((day.getUTCDay() + MONDAY_OFFSET) % DAYS_PER_WEEK) * DAY_MS);
  return day;
}

function nextStart(calendar: Calendar, start: Date): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  if (calendar === 'yearly') return new Date(Date.UTC(year + 1, 0, 1));
  if (calendar === 'monthly') return new Date(Date.UTC(year, month + 1, 1));
  return new Date(start.getTime() + (calendar === 'weekly' ? DAYS_PER_WEEK : 1) * DAY_MS);
}

function labelOf(calendar: Calendar, start: Date): string {
  const iso = start.toISOString();
  if (calendar === 'yearly') return iso.slice(0, 4);
  return calendar === 'monthly' ? iso.slice(0, 7) : iso.slice(0, 10);
}

function calendarBuckets(calendar: Calendar, range: DateRange, pullRequests: PullRequestActivity[], today: Date): PeriodBucket[] {
  const buckets: PeriodBucket[] = [];
  const last = utcDay(range.until);
  for (let start = startOf(calendar, utcDay(range.since)); start <= last; start = nextStart(calendar, start)) {
    const label = labelOf(calendar, start);
    const inPeriod = pullRequests.filter((pr) => labelOf(calendar, startOf(calendar, utcDay(pr.mergedAt))) === label);
    buckets.push({ label, pullRequests: inPeriod, inProgress: nextStart(calendar, start) > today });
  }
  return buckets;
}

export function bucketsOf(period: string, range: DateRange, pullRequests: PullRequestActivity[], now: Date): PeriodBucket[] {
  if (period === OVERALL_LABEL) return [{ label: OVERALL_LABEL, pullRequests, inProgress: false }];
  return calendarBuckets(period as Calendar, range, pullRequests, utcDay(now.toISOString()));
}
