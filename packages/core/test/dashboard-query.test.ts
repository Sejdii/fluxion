import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  LOW_SAMPLE_THRESHOLD,
  UsageError,
  queryDashboard,
  type DashboardRequest,
  type MetricPorts,
  type PullRequestActivity,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const now = new Date('2026-03-20T10:00:00Z');

function mergedAt(timestamp: string, number: number, additions = 1): PullRequestActivity {
  return {
    number,
    author: { login: 'ann', isBot: false },
    createdAt: '2025-01-01T00:00:00Z',
    mergedAt: timestamp,
    additions,
    deletions: 0,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
  };
}

function portsWith(...pullRequests: PullRequestActivity[]): MetricPorts {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  return { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
}

function request(overrides: Partial<DashboardRequest> = {}): DashboardRequest {
  return { family: 'pr', period: 'monthly', since: '2026-02-01', until: '2026-03-20', ...overrides };
}

test('overviewHasOneEntryPerRegistryMetricOfTheFamily', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect(overview.metrics.map((metric) => metric.id)).toEqual([
    'prsMerged',
    'reviewWaitingTime',
    'totalReviewTime',
    'prSize',
    'comments',
    'reviewers',
  ]);
});

test('overviewCarriesRangeStatusFactsAndLowSampleThreshold', async () => {
  const overview = await queryDashboard(portsWith(mergedAt('2026-03-01T10:00:00Z', 1)), request(), now);

  expect(overview).toMatchObject({
    range: { since: '2026-02-01', until: '2026-03-20' },
    previousRange: { since: '2025-12-15', until: '2026-01-31' },
    n: 1,
    fetchedAt: '2026-03-20T10:00:00.000Z',
    lowSampleThreshold: LOW_SAMPLE_THRESHOLD,
  });
});

test('prsMergedRowsCarryTheTotalWithN', async () => {
  const ports = portsWith(mergedAt('2026-02-05T10:00:00Z', 1), mergedAt('2026-02-06T10:00:00Z', 2));

  const overview = await queryDashboard(ports, request(), now);

  expect(overview.metrics[0]?.rows[0]).toEqual({ period: '2026-02', n: 2, values: { total: 2 } });
});

test('perPullRequestRowsCarryMedianAndP90', async () => {
  const sizes = [1, 2, 3, 4, 5];
  const ports = portsWith(...sizes.map((size) => mergedAt('2026-02-05T10:00:00Z', size, size)));

  const overview = await queryDashboard(ports, request(), now);

  expect(overview.metrics[3]?.rows[0]).toEqual({ period: '2026-02', n: 5, values: { median: 3, p90: 5 } });
});

function withComments(pullRequest: PullRequestActivity, humans: number, replies = 0): PullRequestActivity {
  const human = { actor: { login: 'bob', isBot: false }, at: '2026-02-05T11:00:00Z' };
  const bot = { actor: { login: 'ci', isBot: true }, at: '2026-02-05T11:00:00Z' };
  const author = { actor: { login: 'ann', isBot: false }, at: '2026-02-05T12:00:00Z' };
  return { ...pullRequest, comments: [...Array<typeof human>(humans).fill(human), bot, ...Array<typeof author>(replies).fill(author)] };
}

test('commentsRowsCarryTheTotalOfHumanCommentsIncludingAuthorRepliesAndExcludingBots', async () => {
  const ports = portsWith(withComments(mergedAt('2026-02-05T10:00:00Z', 1), 2, 1), withComments(mergedAt('2026-02-06T10:00:00Z', 2), 4));

  const comments = (await queryDashboard(ports, request(), now)).metrics[4];

  expect(comments?.rows[0]).toMatchObject({ period: '2026-02', n: 2, values: { median: 3.5, total: 7 } });
  expect(comments?.tiles.current.values['total']).toBe(7);
});

test('commentsTotalIsZeroForAPeriodWithoutMergedPullRequests', async () => {
  const comments = (await queryDashboard(portsWith(), request(), now)).metrics[4];

  expect(comments?.rows[0]?.values['total']).toBe(0);
});

test('emptyPeriodIsARowWithoutValues', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect(overview.metrics[3]?.rows[0]).toEqual({ period: '2026-02', n: 0, values: { median: null, p90: null }, lowSample: true });
});

test('unfinishedPeriodIsMarkedInProgress', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect(overview.metrics[0]?.rows[1]?.inProgress).toBe(true);
});

test('tilesHoldTheWholeRangeAndThePreviousRange', async () => {
  const ports = portsWith(
    mergedAt('2026-03-01T10:00:00Z', 1, 10),
    mergedAt('2026-03-02T10:00:00Z', 2, 20),
    mergedAt('2026-01-10T10:00:00Z', 3, 40),
  );

  const overview = await queryDashboard(ports, request(), now);

  expect(overview.metrics[3]?.tiles).toEqual({
    current: { n: 2, values: { median: 15, p90: null }, lowSample: true },
    previous: { n: 1, values: { median: 40, p90: null }, lowSample: true },
  });
});

test('metricsDeclareTheirUnit', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect(overview.metrics.map((metric) => metric.unit)).toEqual([undefined, 'hours', 'hours', 'lines', undefined, undefined]);
});

test('unknownFamilyIsAUsageError', async () => {
  await expect(queryDashboard(portsWith(), request({ family: 'dora' }), now)).rejects.toThrow(UsageError);
});

test('unsupportedPeriodIsAUsageError', async () => {
  await expect(queryDashboard(portsWith(), request({ period: 'hourly' }), now)).rejects.toThrow(UsageError);
});

test('failingRepositoryIsNamedInTheDataError', async () => {
  const failing = { mergedPullRequests: () => Promise.reject(new DataError('boom')), pullRequest: () => Promise.resolve(null) };
  const ports = { pullRequests: failing, repositories: new InMemoryRepositoryFinder(repository) };

  await expect(queryDashboard(ports, request(), now)).rejects.toThrow('acme/app: boom');
});

test('overviewNamesThePooledRepositories', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect(overview.repositories).toEqual(['acme/app']);
});

test('overviewStatesTheLongestRangeThatAllowsTheDayPeriod', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect(overview.dayPeriodMaxMonths).toBe(12);
});

test('overviewRejectsTheDayPeriodOverTwelveMonths', async () => {
  const overview = queryDashboard(portsWith(), request({ period: 'daily', since: '2025-03-01', until: '2026-03-20' }), now);

  await expect(overview).rejects.toThrow('The day period needs a range of at most 12 months');
});

test('overviewAcceptsTheDayPeriodForExactlyTwelveMonths', async () => {
  const overview = await queryDashboard(portsWith(), request({ period: 'daily', since: '2025-04-01', until: '2026-03-31' }), now);

  expect(overview.range.since).toBe('2025-04-01');
});

function reviewedOn(readyAt: string, commentedAt: string, mergedOn: string, number: number): PullRequestActivity {
  return { ...mergedAt(mergedOn, number), createdAt: readyAt, comments: [{ actor: { login: 'bob', isBot: false }, at: commentedAt }] };
}

test('workScheduleIsAppliedToTilesAndRowsOfTheCurrentAndPreviousRange', async () => {
  const schedule = { days: ['mon' as const], start: '09:00', end: '17:00', timeZone: 'UTC' };
  const ports = portsWith(
    reviewedOn('2026-03-06T17:00:00Z', '2026-03-09T10:00:00Z', '2026-03-10T10:00:00Z', 1),
    reviewedOn('2026-01-09T17:00:00Z', '2026-01-12T11:00:00Z', '2026-01-13T10:00:00Z', 2),
  );

  const plain = await queryDashboard(ports, request(), now);
  const working = await queryDashboard(ports, request({ workSchedule: schedule }), now);
  const waiting = (dashboard: typeof plain) => dashboard.metrics.find((metric) => metric.id === 'reviewWaitingTime');

  expect(waiting(plain)?.tiles.current.values.median).toBe(65);
  expect(waiting(working)?.tiles.current.values.median).toBe(1);
  expect(waiting(working)?.tiles.previous.values.median).toBe(2);
  expect(waiting(working)?.rows.at(-1)?.values.median).toBe(1);
  expect(working.workSchedule).toEqual(schedule);
});

test('overviewEchoesNoScheduleWhenNoneIsSet', async () => {
  const overview = await queryDashboard(portsWith(), request(), now);

  expect('workSchedule' in overview).toBe(false);
});
