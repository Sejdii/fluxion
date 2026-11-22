import { expect, test } from 'vitest';
import type { Explanation, MetricResult } from '@fluxion/core';
import { runCli, type CliMetricRequest, type ExplainRequest, type RunExplain, type RunMetric } from '../src/program.js';

const explanation: Explanation = {
  number: 7,
  facts: { readyForReviewAt: '2026-01-05T08:00:00Z', firstResponse: { kind: 'human', by: 'bob', at: '2026-01-05T10:00:00Z' }, mergedAt: '2026-01-05T18:00:00Z', comments: 1, reviewers: ['bob'] },
  values: [{ metric: 'totalReviewTime', unit: 'hours', value: 8 }, { metric: 'prSize', unit: 'lines', value: 42 }],
};

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

async function explain(args: string[], useCase: RunExplain = () => Promise.resolve(explanation)) {
  const outcome = { code: -1, stdout: '', stderr: '', requests: [] as ExplainRequest[] };
  outcome.code = await runCli(
    ['pr', 'explain', '7', ...args],
    {
      metric: () => Promise.reject(new Error('unused')),
      explain: (request) => {
        outcome.requests.push(request);
        return useCase(request);
      },
      serve: () => Promise.resolve(''),
    },
    { stdout: (text) => (outcome.stdout += text), stderr: (text) => (outcome.stderr += text) },
  );
  return outcome;
}

test('explainWithoutWorkFlagsLeavesTheScheduleOutOfTheRequest', async () => {
  const outcome = await explain([]);

  expect(outcome.requests).toEqual([{ number: 7 }]);
  expect(outcome.stdout).not.toContain('working time');
});

test('explainParsesWorkFlagsIntoTheSchedule', async () => {
  const outcome = await explain(['--work-days', 'mon,wed', '--work-hours', '07:00-18:00', '--timezone', 'UTC']);

  expect(outcome.requests[0]?.workSchedule).toEqual({ days: ['mon', 'wed'], start: '07:00', end: '18:00', timeZone: 'UTC' });
});

test('explainWithInvalidWorkHoursIsAUsageError', async () => {
  const outcome = await explain(['--work-hours', '18:00-07:00']);

  expect(outcome).toMatchObject({ code: 1, requests: [], stderr: 'error: Work hours "18:00-07:00" must start before they end\n' });
});

test('explainLabelsWorkingTimeAndKeepsTheRawTimestamps', async () => {
  const schedule = { days: ['mon' as const], start: '09:00', end: '17:00', timeZone: 'UTC' };
  const withSchedule: Explanation = { ...explanation, workSchedule: schedule, facts: { ...explanation.facts, firstResponseWorkingHours: 1 } };

  const outcome = await explain(['--work-days', 'mon'], () => Promise.resolve(withSchedule));

  expect(outcome.stdout).toContain('working time: mon 09:00-17:00 UTC');
  expect(outcome.stdout).toContain('2026-01-05T10:00:00Z by bob');
  expect(outcome.stdout).toContain('first response after  1 h (working time)');
  expect(outcome.stdout).toContain('8 hours (working time)');
  expect(outcome.stdout).toContain('42 lines');
  expect(outcome.stdout).not.toContain('42 lines (working');
});

test('explainJsonEchoesTheScheduleOnlyWhenSet', async () => {
  const unset = await explain(['--json']);
  const set = await explain(['--json'], () => Promise.resolve({ ...explanation, workSchedule: { days: ['mon'], start: '09:00', end: '17:00', timeZone: 'UTC' } }));

  expect('workSchedule' in JSON.parse(unset.stdout)).toBe(false);
  expect(JSON.parse(set.stdout)).toMatchObject({ workSchedule: { timeZone: 'UTC' } });
});
