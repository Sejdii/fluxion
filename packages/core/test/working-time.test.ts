import { expect, test } from 'vitest';
import {
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  UsageError,
  parseWorkSchedule,
  queryMetric,
  type Actor,
  type PullRequestActivity,
  type RepositoryRef,
  type WorkSchedule,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const now = new Date('2026-11-20T10:00:00Z');
const reviewer: Actor = { login: 'bob', isBot: false };
const warsawDays = parseWorkSchedule({ hours: '07:00-18:00', timeZone: 'Europe/Warsaw' });

function pullRequest(readyAt: string, firstCommentAt: string | null, mergedAt: string): PullRequestActivity {
  return {
    number: 1,
    author: { login: 'ann', isBot: false },
    createdAt: readyAt,
    mergedAt,
    additions: 1,
    deletions: 1,
    draftEvents: [],
    comments: firstCommentAt === null ? [] : [{ actor: reviewer, at: firstCommentAt }],
    reviewComments: [],
    reviews: [],
  };
}

async function measure(metric: string, pr: PullRequestActivity, workSchedule?: WorkSchedule) {
  const source = new InMemoryPullRequestSource();
  source.set(repository, [pr]);
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
  const request = { family: 'pr', metric, statistic: 'median', period: 'overall', since: '2026-01-01', until: '2026-11-20', workSchedule };
  return queryMetric(ports, request, now);
}

const waiting = async (pr: PullRequestActivity, schedule?: WorkSchedule) => (await measure('reviewWaitingTime', pr, schedule)).rows[0]?.value;
const totalTime = async (pr: PullRequestActivity, schedule?: WorkSchedule) => (await measure('totalReviewTime', pr, schedule)).rows[0]?.value;

test('withoutAScheduleDurationsStayWallClock', async () => {
  const pr = pullRequest('2026-01-05T17:00:00Z', '2026-01-06T07:00:00Z', '2026-01-06T09:00:00Z');

  expect(await waiting(pr)).toBe(14);
});

test('readyAfterHoursAndCommentedBeforeHoursCountsOnlyTheNextMorningHour', async () => {
  const pr = pullRequest('2026-01-05T17:00:00Z', '2026-01-06T07:00:00Z', '2026-01-06T09:00:00Z');

  expect(await waiting(pr, warsawDays)).toBe(1);
});

test('fridayToMondayWaitCountsOnlyWorkingHours', async () => {
  const pr = pullRequest('2026-01-09T15:00:00Z', '2026-01-12T10:00:00Z', '2026-01-12T11:00:00Z');

  expect(await waiting(pr, parseWorkSchedule({ hours: '09:00-17:00', timeZone: 'UTC' }))).toBe(3);
});

test('commentAfterHoursCountsAsTheEndOfTheLastWorkingHours', async () => {
  const pr = pullRequest('2026-01-05T08:00:00Z', '2026-01-05T20:00:00Z', '2026-01-06T09:00:00Z');

  expect(await waiting(pr, parseWorkSchedule({ hours: '09:00-17:00', timeZone: 'UTC' }))).toBe(8);
});

test('mergeOnANonWorkingDayCountsAsTheEndOfFridayHours', async () => {
  const pr = pullRequest('2026-01-09T14:00:00Z', null, '2026-01-10T12:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ hours: '09:00-17:00', timeZone: 'UTC' }))).toBe(3);
});

test('readyOnASaturdayStartsCountingOnMondayMorning', async () => {
  const pr = pullRequest('2026-01-10T12:00:00Z', null, '2026-01-12T11:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ hours: '09:00-17:00', timeZone: 'UTC' }))).toBe(2);
});

test('durationWithNoWorkingTimeIsZeroAndKeptInTheStatistics', async () => {
  const pr = pullRequest('2026-01-10T08:00:00Z', null, '2026-01-11T20:00:00Z');

  const result = await measure('totalReviewTime', pr, parseWorkSchedule({ timeZone: 'UTC' }));

  expect(result.rows[0]).toMatchObject({ n: 1, value: 0 });
});

test('aMergeBeforeReadyForReviewHasNoWorkingTime', async () => {
  const pr = pullRequest('2026-01-06T12:00:00Z', null, '2026-01-05T12:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ timeZone: 'UTC' }))).toBe(0);
});

test('customWorkingDaysAreRespected', async () => {
  const pr = pullRequest('2026-01-05T09:00:00Z', null, '2026-01-07T17:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ days: 'mon,wed', timeZone: 'UTC' }))).toBe(16);
});

test('aSpringForwardDayIsAnHourShorter', async () => {
  const pr = pullRequest('2026-03-28T23:00:00Z', null, '2026-03-29T12:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ days: 'sun', hours: '00:00-08:00', timeZone: 'Europe/Warsaw' }))).toBe(7);
});

test('aWindowEndingInTheSkippedHourEndsWhenTheClockJumps', async () => {
  const pr = pullRequest('2026-03-28T23:00:00Z', null, '2026-03-29T12:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ days: 'sun', hours: '00:00-02:30', timeZone: 'Europe/Warsaw' }))).toBe(2.5);
});

test('aFallBackDayIsAnHourLonger', async () => {
  const pr = pullRequest('2026-10-24T22:00:00Z', null, '2026-10-25T12:00:00Z');

  expect(await totalTime(pr, parseWorkSchedule({ days: 'sun', hours: '00:00-08:00', timeZone: 'Europe/Warsaw' }))).toBe(9);
});

test('theResultEchoesTheScheduleOnlyWhenOneIsSet', async () => {
  const pr = pullRequest('2026-01-05T08:00:00Z', null, '2026-01-05T10:00:00Z');

  const withSchedule = await measure('totalReviewTime', pr, warsawDays);
  const without = await measure('totalReviewTime', pr);

  expect({ with: withSchedule.workSchedule, without: 'workSchedule' in without }).toEqual({ with: warsawDays, without: false });
});

test('prSizeIsUnaffectedByTheSchedule', async () => {
  const pr = pullRequest('2026-01-10T08:00:00Z', null, '2026-01-11T20:00:00Z');

  expect((await measure('prSize', pr, warsawDays)).rows[0]?.value).toBe(2);
});

test('anyOneInputEnablesTheScheduleWithDefaultsForTheRest', () => {
  const schedule = parseWorkSchedule({ hours: '08:30-16:00' });

  expect(schedule).toMatchObject({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:30', end: '16:00' });
});

test('workDaysAcceptRangesAndLists', () => {
  expect([parseWorkSchedule({ days: 'mon-wed,fri' }).days, parseWorkSchedule({ days: 'sat-mon' }).days]).toEqual([
    ['mon', 'tue', 'wed', 'fri'],
    ['mon', 'sat', 'sun'],
  ]);
});

test.each([
  ['hours that do not start before they end', { hours: '17:00-09:00' }],
  ['equal hours', { hours: '09:00-09:00' }],
  ['hours without an end', { hours: '09:00' }],
  ['a malformed time', { hours: '9am-5pm' }],
  ['an unknown time zone', { timeZone: 'Mars/Base' }],
  ['an empty weekday list', { days: '' }],
  ['a three-part range', { days: 'mon-tue-wed' }],
  ['an unknown weekday', { days: 'mon-funday' }],
])('rejects%s', (_, input) => {
  expect(() => parseWorkSchedule(input)).toThrow(UsageError);
});
