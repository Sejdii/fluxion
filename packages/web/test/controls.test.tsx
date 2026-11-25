import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Controls } from '../src/Controls.js';
import type { WorkSchedule } from '@fluxion/core';
import type { Query } from '../src/query.js';

const today = new Date('2026-11-22T15:00:00Z');

function controls(overrides: Partial<Query>): string {
  const applied: Query = { repos: ['app'], since: '2025-01-01', until: '2026-11-22', period: 'monthly', compare: 'always', ...overrides };
  return renderToStaticMarkup(<Controls options={[{ path: 'app', name: 'app' }]} applied={applied} dayPeriodMaxMonths={12} today={today} onApply={() => undefined} disabled={false} />);
}

test('yearPeriodShowsTwoYearSelectsInsteadOfDateInputs', () => {
  const markup = controls({ period: 'yearly' });
  expect(markup.match(/<select/g)).toHaveLength(2);
  expect(markup).not.toContain('type="date"');
});

test('yearSelectsShowTheYearsOfTheRange', () => {
  const markup = controls({ period: 'yearly' });
  expect(markup).toContain('<option value="2025" selected="">2025</option>');
  expect(markup).toContain('<option value="2026" selected="">2026</option>');
});

test('otherPeriodsKeepTheDateInputs', () => {
  const markup = controls({ period: 'weekly' });
  expect(markup.match(/type="date"/g)).toHaveLength(2);
  expect(markup).not.toContain('<select');
});

const schedule: WorkSchedule = { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00', timeZone: 'Europe/Warsaw' };

test('settingsWithoutAScheduleOnlyOfferTheToggle', () => {
  const markup = controls({ workSchedule: null });
  expect(markup).toContain('Measure in working time');
  expect(markup).not.toContain('type="time"');
});

test('settingsWithAScheduleShowDaysHoursAndTimeZone', () => {
  const markup = controls({ workSchedule: schedule });
  expect(markup.match(/type="time"/g)).toHaveLength(2);
  expect(markup).toContain('<option value="Europe/Warsaw" selected="">Europe/Warsaw</option>');
  expect(markup.match(/type="checkbox" checked=""/g)).toHaveLength(1 + 1 + 5);
});

test('applyIsDisabledUntilTheScheduleChanges', () => {
  expect(controls({ workSchedule: schedule })).toContain('class="apply" disabled=""');
});
