import type { DateRange } from './pull-request-source.js';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Splits an inclusive range into UTC calendar-month chunks; the first and last are clipped to the range. */
export function monthChunks(range: DateRange): DateRange[] {
  const chunks: DateRange[] = [];
  const last = utcDay(range.until);
  const first = utcDay(range.since);
  for (let start = first; start <= last; start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))) {
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    chunks.push({ since: isoDate(start), until: isoDate(monthEnd < last ? monthEnd : last) });
  }
  return chunks;
}
