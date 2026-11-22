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
