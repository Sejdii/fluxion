import { UsageError } from './errors.js';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MINUTES_PER_HOUR = 60;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type Weekday = (typeof WEEKDAYS)[number];
const MONDAY_FIRST: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEK_LENGTH = WEEKDAYS.length;
const DEFAULT_DAYS = 'mon-fri';
const DEFAULT_HOURS = '09:00-17:00';
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type { Weekday };

export interface WorkSchedule {
  days: Weekday[];
  start: string;
  end: string;
  timeZone: string;
}

export interface WorkScheduleInput {
  days?: string | undefined;
  hours?: string | undefined;
  timeZone?: string | undefined;
}

function weekdayIndex(text: string): number {
  const index = WEEKDAYS.indexOf(text.trim().toLowerCase() as Weekday);
  if (index === -1) throw new UsageError(`Unknown weekday "${text}". Use ${MONDAY_FIRST.join(', ')}`);
  return index;
}

function daysOfItem(item: string): number[] {
  const bounds = item.split('-').map(weekdayIndex);
  if (bounds.length > 2) throw new UsageError(`Invalid work days "${item}". Use a range like mon-fri or a list like mon,wed,fri`);
  const [from, to = from] = bounds as [number, number?];
  const length = ((to - from + WEEK_LENGTH) % WEEK_LENGTH) + 1;
  return Array.from({ length }, (_, offset) => (from + offset) % WEEK_LENGTH);
}

function parseDays(text: string): Weekday[] {
  if (text.trim() === '') throw new UsageError('Work days must not be empty');
  const indexes = new Set(text.split(',').flatMap(daysOfItem));
  return MONDAY_FIRST.filter((day) => indexes.has(WEEKDAYS.indexOf(day)));
}

function minutesOf(time: string): number {
  const match = TIME_PATTERN.exec(time.trim());
  if (!match) throw new UsageError(`Invalid time "${time}". Use HH:MM`);
  const [hours, minutes] = match.slice(1).map(Number) as [number, number];
  return hours * MINUTES_PER_HOUR + minutes;
}

function parseHours(text: string): { start: string; end: string } {
  const bounds = text.split('-').map((part) => part.trim());
  if (bounds.length !== 2) throw new UsageError(`Invalid work hours "${text}". Use HH:MM-HH:MM`);
  const [start, end] = bounds as [string, string];
  if (minutesOf(start) >= minutesOf(end)) throw new UsageError(`Work hours "${text}" must start before they end`);
  return { start, end };
}

function machineTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function checkedTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new UsageError(`Unknown time zone "${timeZone}". Use an IANA name such as Europe/Warsaw`);
  }
  return timeZone;
}

export function parseWorkSchedule(input: WorkScheduleInput): WorkSchedule {
  return {
    days: parseDays(input.days ?? DEFAULT_DAYS),
    ...parseHours(input.hours ?? DEFAULT_HOURS),
    timeZone: checkedTimeZone(input.timeZone ?? machineTimeZone()),
  };
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterOf(timeZone: string): Intl.DateTimeFormat {
  const known = formatters.get(timeZone);
  if (known) return known;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  formatters.set(timeZone, created);
  return created;
}

type LocalField = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

function localFieldsAt(instant: number, timeZone: string): Record<LocalField, number> {
  const parts = formatterOf(timeZone).formatToParts(new Date(instant));
  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)])) as Record<LocalField, number>;
}

function localDateAt(instant: number, timeZone: string): LocalDate {
  const { year, month, day } = localFieldsAt(instant, timeZone);
  return { year, month, day };
}

function offsetAt(instant: number, timeZone: string): number {
  const { year, month, day, hour, minute, second } = localFieldsAt(instant, timeZone);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return wallClockAsUtc - Math.floor(instant / 1000) * 1000;
}

const MS_PER_SECOND = 1000;

function transitionBetween(earlier: number, later: number, timeZone: string): number {
  const offsetAfter = offsetAt(later, timeZone);
  let [before, after] = [earlier, later];
  while (after - before > MS_PER_SECOND) {
    const middle = Math.floor((before + after) / 2);
    if (offsetAt(middle, timeZone) === offsetAfter) after = middle;
    else before = middle;
  }
  return after;
}

function computeInstantOf(date: LocalDate, minutes: number, timeZone: string): number {
  const wallClockAsUtc = Date.UTC(date.year, date.month - 1, date.day, 0, minutes);
  const firstOffset = offsetAt(wallClockAsUtc, timeZone);
  const guess = wallClockAsUtc - firstOffset;
  const secondOffset = offsetAt(guess, timeZone);
  if (secondOffset === firstOffset) return guess;
  return transitionBetween(Math.min(guess, wallClockAsUtc - secondOffset), Math.max(guess, wallClockAsUtc - secondOffset), timeZone);
}

const instants = new Map<string, number>();

function instantOf(date: LocalDate, minutes: number, timeZone: string): number {
  const key = `${timeZone}|${date.year}-${date.month}-${date.day}|${minutes}`;
  const known = instants.get(key);
  if (known !== undefined) return known;
  const computed = computeInstantOf(date, minutes, timeZone);
  instants.set(key, computed);
  return computed;
}

function weekdayOf(date: LocalDate): Weekday {
  return WEEKDAYS[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()] as Weekday;
}

function nextDate(date: LocalDate): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day) + MS_PER_DAY);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function sameDate(a: LocalDate, b: LocalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function workingHoursBetween(schedule: WorkSchedule, start: string, end: string): number {
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (to <= from) return 0;
  const opens = minutesOf(schedule.start);
  const closes = minutesOf(schedule.end);
  const lastDate = localDateAt(to, schedule.timeZone);
  let total = 0;
  for (let date = localDateAt(from, schedule.timeZone); ; date = nextDate(date)) {
    if (schedule.days.includes(weekdayOf(date))) {
      const overlapStart = Math.max(from, instantOf(date, opens, schedule.timeZone));
      const overlapEnd = Math.min(to, instantOf(date, closes, schedule.timeZone));
      total += Math.max(0, overlapEnd - overlapStart);
    }
    if (sameDate(date, lastDate)) return total / MS_PER_HOUR;
  }
}
