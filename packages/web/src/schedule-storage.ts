import type { WorkSchedule } from '@fluxion/core';
import { WEEKDAYS, type ScheduleChoice } from './query.js';

const KEY = 'fluxion.workSchedule';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Stored = Pick<Storage, 'getItem' | 'setItem'>;

function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

function isSchedule(value: unknown): value is WorkSchedule {
  if (typeof value !== 'object' || value === null) return false;
  const { days, start, end, timeZone } = value as Record<string, unknown>;
  const validDays = Array.isArray(days) && days.length > 0 && days.every((day) => WEEKDAYS.includes(day as never));
  return validDays && isTime(start) && isTime(end) && start < end && typeof timeZone === 'string' && timeZone !== '';
}

export function loadSchedule(storage: Stored | undefined): ScheduleChoice {
  try {
    const text = storage?.getItem(KEY);
    if (text === null || text === undefined) return undefined;
    const value: unknown = JSON.parse(text);
    return value === null || isSchedule(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function saveSchedule(storage: Stored | undefined, schedule: WorkSchedule | null): void {
  try {
    storage?.setItem(KEY, JSON.stringify(schedule));
  } catch {
    return;
  }
}
