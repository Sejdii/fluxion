import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  parseComparisonMode,
  parseLargeLoadThreshold,
  queryDashboard,
  UsageError,
  type ComparisonMode,
  type DashboardProgress,
  type FetchedPullRequest,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'app' };
const apiRepository: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'api' };
const now = new Date('2026-03-20T10:00:00Z');
const selected = { since: '2026-02-01', until: '2026-03-20' };
const previous = { since: '2025-12-15', until: '2026-01-31' };

function mergedPullRequests(count: number): FetchedPullRequest[] {
  return Array.from({ length: count }, (_, number) => ({ number, author: null, createdAt: '2026-03-01T00:00:00Z', mergedAt: '2026-03-02T00:00:00Z', additions: 1, deletions: 0, draftEvents: [], comments: [], reviewComments: [], reviews: [] }));
}

function dashboardOver(source: InMemoryPullRequestSource, repositories: RepositoryRef[], compare: ComparisonMode | undefined, largeLoadThreshold?: number) {
  const reported: DashboardProgress[] = [];
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(...repositories) };
  const request = { family: 'pr', period: 'monthly', ...selected, ...(compare ? { compare } : {}), ...(largeLoadThreshold ? { largeLoadThreshold } : {}) };
  const query = () => queryDashboard(ports, request, now, (progress) => reported.push(progress));
  return { source, reported, query };
}

function setUp(compare?: ComparisonMode, count = 0, largeLoadThreshold?: number) {
  const source = new InMemoryPullRequestSource();
  source.set(repository, mergedPullRequests(count));
  return dashboardOver(source, [repository], compare, largeLoadThreshold);
}

async function previousTileOf(dashboard: ReturnType<ReturnType<typeof setUp>['query']>) {
  return (await dashboard).metrics[0]?.tiles.previous;
}

test('neverFetchesNothingFromThePreviousRange', async () => {
  const { source, query } = setUp('never');

  await query();

  expect(source.requested).toEqual([selected]);
});

test('neverSaysThatTheComparisonWasTurnedOff', async () => {
  const overview = await setUp('never').query();

  expect(overview.metrics.map((metric) => metric.tiles.previous)).toEqual(Array(6).fill({ skipped: 'turnedOff' }));
});

test('neverCountsOnlyTheMonthsOfTheSelectedRangeInTheProgressTotal', async () => {
  const { reported, query } = setUp('never');

  await query();

  expect(reported[0]).toEqual({ fetchedMonths: 0, totalMonths: 2 });
});

test('autoComparesARangeBelowTheLargeLoadThreshold', async () => {
  const { source, query } = setUp('auto', 499);

  await query();

  expect(source.requested).toEqual([selected, previous]);
});

test('autoComparesARangeAtTheLargeLoadThreshold', async () => {
  expect(await previousTileOf(setUp('auto', 500).query())).toEqual({ n: 0, values: { total: 0 } });
});

test('autoSkipsARangeAboveTheLargeLoadThreshold', async () => {
  const overview = await setUp('auto', 501).query();

  expect(overview.metrics.map((metric) => metric.tiles.previous)).toEqual(Array(6).fill({ skipped: 'largeLoad', threshold: 500 }));
});

test('autoFetchesNothingFromThePreviousRangeOfALargeLoad', async () => {
  const { source, query } = setUp('auto', 501);

  await query();

  expect(source.requested).toEqual([selected]);
});

test('autoCountsOnlyTheMonthsOfTheSelectedRangeInTheProgressTotalOfALargeLoad', async () => {
  const { reported, query } = setUp('auto', 501);

  await query();

  expect(reported[0]).toEqual({ fetchedMonths: 0, totalMonths: 2 });
});

test('autoSumsTheCountOverTheSelectedRepositories', async () => {
  const source = new InMemoryPullRequestSource();
  source.set(repository, mergedPullRequests(300));
  source.set(apiRepository, mergedPullRequests(201));

  const { query } = dashboardOver(source, [repository, apiRepository], 'auto');

  expect(await previousTileOf(query())).toEqual({ skipped: 'largeLoad', threshold: 500 });
});

test('autoSkipsTheComparisonWhenTheCountCannotBeChecked', async () => {
  const { source, query } = setUp('auto', 3);
  source.failCountsWith(new DataError('rate limit'));

  expect(await previousTileOf(query())).toEqual({ skipped: 'countUnavailable' });
});

test('autoFetchesOnlyTheSelectedRangeWhenTheCountCannotBeChecked', async () => {
  const { source, query } = setUp('auto', 3);
  source.failCountsWith(new DataError('rate limit'));

  await query();

  expect(source.requested).toEqual([selected]);
});

test('autoDecidesAgainOnTheNextQuery', async () => {
  const { source, query } = setUp('auto', 3);
  source.failCountsWith(new DataError('rate limit'));
  await query();
  source.failCountsWith(null);

  expect(await previousTileOf(query())).toEqual({ n: 0, values: { total: 0 } });
});

test('anUnexpectedFailureOfTheCountFailsTheQuery', async () => {
  const { source, query } = setUp('auto');
  source.failCountsWith(new TypeError('boom'));

  await expect(query()).rejects.toThrow(TypeError);
});

test('alwaysComparesALargeLoad', async () => {
  const { source, query } = setUp('always', 501);

  await query();

  expect(source.requested).toEqual([selected, previous]);
});

test('alwaysDoesNotProbeTheCount', async () => {
  const { source, query } = setUp('always');

  await query();

  expect(source.counted).toEqual([]);
});

test('neverDoesNotProbeTheCount', async () => {
  const { source, query } = setUp('never');

  await query();

  expect(source.counted).toEqual([]);
});

test('withoutAModeTheComparisonIsAutomatic', async () => {
  expect(await previousTileOf(setUp(undefined, 501).query())).toEqual({ skipped: 'largeLoad', threshold: 500 });
});

test('anUnknownModeIsAUsageError', () => {
  expect(() => parseComparisonMode('sometimes')).toThrow(new UsageError('Unknown comparison mode "sometimes". Use auto, always, never'));
});

test('autoSkipsARangeAboveTheGivenThresholdAndNamesIt', async () => {
  expect(await previousTileOf(setUp('auto', 11, 10).query())).toEqual({ skipped: 'largeLoad', threshold: 10 });
});

test('autoComparesARangeAboveTheDefaultButWithinTheGivenThreshold', async () => {
  const { source, query } = setUp('auto', 501, 600);

  await query();

  expect(source.requested).toEqual([selected, previous]);
});

test('aWholeNumberOfAtLeastOneIsALargeLoadThreshold', () => {
  expect(parseLargeLoadThreshold('1')).toBe(1);
});

test.each([[''], ['0'], ['-1'], ['1.5'], ['1e3'], ['many'], ['99999999999999999999']])('anInvalidLargeLoadThresholdIsAUsageError%#', (text) => {
  expect(() => parseLargeLoadThreshold(text)).toThrow(new UsageError(`Invalid large load threshold "${text}". Use a whole number of at least 1`));
});
