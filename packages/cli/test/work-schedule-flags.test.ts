import { expect, test } from 'vitest';
import type { MetricResult } from '@fluxion/core';
import { runCli, type CliMetricRequest, type RunMetric } from '../src/program.js';

const result: MetricResult = { range: { since: '2026-01-01', until: '2026-02-28' }, rows: [{ period: '2026-01', n: 12, value: 12 }] };

async function run(args: string[], useCase: RunMetric = () => Promise.resolve(result)) {
  const outcome = { code: -1, stdout: '', stderr: '', requests: [] as CliMetricRequest[] };
  outcome.code = await runCli(
    args,
    {
      metric: (request) => {
        outcome.requests.push(request);
        return useCase(request);
      },
      explain: () => Promise.reject(new Error('unused')),
      serve: () => Promise.resolve(''),
    },
    { stdout: (text) => (outcome.stdout += text), stderr: (text) => (outcome.stderr += text) },
  );
  return outcome;
}

test('noWorkFlagsLeaveTheScheduleOutOfTheRequest', async () => {
  const outcome = await run(['pr', 'totalReviewTime', 'median', 'monthly']);

  expect('workSchedule' in (outcome.requests[0] ?? {})).toBe(false);
});

test('anyOneWorkFlagEnablesTheScheduleWithDefaults', async () => {
  const outcome = await run(['pr', 'totalReviewTime', 'median', 'monthly', '--timezone', 'Europe/Warsaw']);

  expect(outcome.requests[0]?.workSchedule).toEqual({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00', timeZone: 'Europe/Warsaw' });
});

test('workFlagsAreParsedIntoTheSchedule', async () => {
  const outcome = await run(['pr', 'totalReviewTime', 'median', 'monthly', '--work-days', 'mon,wed,fri', '--work-hours', '07:00-18:00', '--timezone', 'UTC']);

  expect(outcome.requests[0]?.workSchedule).toEqual({ days: ['mon', 'wed', 'fri'], start: '07:00', end: '18:00', timeZone: 'UTC' });
});

test('invalidWorkHoursExitWith1AndAMessage', async () => {
  const outcome = await run(['pr', 'totalReviewTime', 'median', 'monthly', '--work-hours', '18:00-07:00']);

  expect(outcome).toMatchObject({ code: 1, requests: [], stderr: 'error: Work hours "18:00-07:00" must start before they end\n' });
});

test('jsonOutputEchoesTheScheduleOnlyWhenSet', async () => {
  const schedule = { days: ['mon' as const], start: '09:00', end: '17:00', timeZone: 'UTC' };

  const outcome = await run(['pr', 'totalReviewTime', 'median', 'monthly', '--json'], () => Promise.resolve({ ...result, workSchedule: schedule }));

  expect(JSON.parse(outcome.stdout)).toMatchObject({ workSchedule: schedule });
});

test('tableOutputStatesTheAppliedScheduleIncludingDefaults', async () => {
  const schedule = { days: ['mon' as const, 'tue' as const], start: '09:00', end: '17:00', timeZone: 'UTC' };

  const outcome = await run(['pr', 'totalReviewTime', 'median', 'monthly'], () => Promise.resolve({ ...result, workSchedule: schedule }));

  expect(outcome.stdout.split('\n')[0]).toBe('working time: mon,tue 09:00-17:00 UTC');
});
