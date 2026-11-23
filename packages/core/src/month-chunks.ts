import { isoDate, utcDay } from './dates.js';
import type { DateRange } from './pull-request-source.js';

function startOfNextMonth(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1));
}

function startOfMonth(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function endOfMonth(start: Date): Date {
  return new Date(startOfNextMonth(start).getTime() - 1);
}

export function monthChunks(range: DateRange): DateRange[] {
  const chunks: DateRange[] = [];
  const last = utcDay(range.until);
  for (let start = startOfMonth(utcDay(range.since)); start <= last; start = startOfNextMonth(start)) {
    chunks.push({ since: isoDate(start), until: isoDate(endOfMonth(start)) });
  }
  return chunks;
}
