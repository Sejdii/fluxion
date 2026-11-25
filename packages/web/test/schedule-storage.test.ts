import { expect, test } from 'vitest';
import { loadSchedule, saveSchedule } from '../src/schedule-storage.js';
import { queryString, type Query } from '../src/query.js';

const schedule = { days: ['mon', 'fri'] as ('mon' | 'fri')[], start: '08:00', end: '16:30', timeZone: 'UTC' };

function memory(initial?: string) {
  const items = new Map<string, string>(initial === undefined ? [] : [['fluxion.workSchedule', initial]]);
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

test('aSavedScheduleComesBack', () => {
  const storage = memory();
  saveSchedule(storage, schedule);
  expect(loadSchedule(storage)).toEqual(schedule);
});

test('aSavedDisabledChoiceComesBackAsNull', () => {
  const storage = memory();
  saveSchedule(storage, null);
  expect(loadSchedule(storage)).toBeNull();
});

test.each([[undefined], ['not json'], ['{"days":[]}'], [JSON.stringify({ ...schedule, end: '07:00' })]])('unusableStorageMeansServerDefault%#', (stored) => {
  expect(loadSchedule(stored === undefined ? memory() : memory(stored))).toBeUndefined();
});

const query: Query = { repos: ['app'], since: '2026-01-01', until: '2026-02-01', period: 'monthly' };

test('queryStringCarriesTheSchedule', () => {
  const params = new URLSearchParams(queryString({ ...query, workSchedule: schedule }, false));
  expect([params.get('workDays'), params.get('workHours'), params.get('timezone'), params.get('workSchedule')]).toEqual(['mon,fri', '08:00-16:30', 'UTC', null]);
});

test('queryStringAsksForNoScheduleWhenDisabledAndNothingWhenUnset', () => {
  expect(new URLSearchParams(queryString({ ...query, workSchedule: null }, false)).get('workSchedule')).toBe('off');
  expect(queryString(query, false)).not.toContain('work');
});
