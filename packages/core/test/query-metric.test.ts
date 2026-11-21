import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  type MetricPorts,
  UsageError,
  listMetrics,
  queryMetric,
  type MetricRequest,
  type PullRequestActivity,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const now = new Date('2026-03-20T10:00:00Z');

function mergedAt(timestamp: string, number = 1): PullRequestActivity {
  return {
    number,
    author: { login: 'ann', isBot: false },
    createdAt: '2025-01-01T00:00:00Z',
    mergedAt: timestamp,
    additions: 1,
    deletions: 1,
    draftEvents: [],
    comments: [],
    reviews: [],
  };
}

function request(overrides: Partial<MetricRequest> = {}): MetricRequest {
  return {
    family: 'pr',
    metric: 'prsMerged',
    statistic: 'total',
    period: 'monthly',
    since: '2026-01-01',
    until: '2026-03-20',
    ...overrides,
  };
}

function portsWith(...pullRequests: PullRequestActivity[]): MetricPorts {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  return { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
}

test('prsMergedTotalMonthlyCountsMergedPrsPerMonthWithN', async () => {
  const ports = portsWith(
    mergedAt('2026-01-05T10:00:00Z', 1),
    mergedAt('2026-01-20T10:00:00Z', 2),
    mergedAt('2026-02-02T10:00:00Z', 3),
  );

  const result = await queryMetric(ports, request(), now);

  expect(result.rows.slice(0, 2)).toEqual([
    { period: '2026-01', n: 2, value: 2 },
    { period: '2026-02', n: 1, value: 1 },
  ]);
});

test('monthWithoutMergedPrsAppearsWithZeroNAndZeroTotal', async () => {
  const ports = portsWith(mergedAt('2026-01-05T10:00:00Z'));

  const result = await queryMetric(ports, request(), now);

  expect(result.rows[1]).toEqual({ period: '2026-02', n: 0, value: 0 });
});

test('rowsCoverEveryMonthOfTheRange', async () => {
  const ports = portsWith();

  const result = await queryMetric(ports, request(), now);

  expect(result.rows.map((row) => row.period)).toEqual(['2026-01', '2026-02', '2026-03']);
});

test('rowsCrossYearBoundary', async () => {
  const ports = portsWith();

  const result = await queryMetric(
    ports,
    request({ since: '2025-11-15', until: '2026-01-02' }),
    now,
  );

  expect(result.rows.map((row) => row.period)).toEqual(['2025-11', '2025-12', '2026-01']);
});

test('prsMergedCountsByUtcMergeDate', async () => {
  const ports = portsWith(
    mergedAt('2026-01-31T23:30:00Z', 1),
    mergedAt('2026-02-01T00:30:00Z', 2),
  );

  const result = await queryMetric(ports, request(), now);

  expect(result.rows.slice(0, 2).map((row) => row.n)).toEqual([1, 1]);
});

test('pullRequestMergedOnTheUntilDateIsIncluded', async () => {
  const ports = portsWith(mergedAt('2026-03-20T23:59:59Z'));

  const result = await queryMetric(ports, request(), now);

  expect(result.rows[2]).toEqual({ period: '2026-03', n: 1, value: 1 });
});

test('pullRequestMergedAfterTheUntilDateIsExcluded', async () => {
  const ports = portsWith(mergedAt('2026-03-21T00:00:00Z'));

  const result = await queryMetric(ports, request(), now);

  expect(result.rows[2]).toEqual({ period: '2026-03', n: 0, value: 0 });
});

test('pullRequestsOfAnotherRepositoryAreNotCounted', async () => {
  const ports = portsWith(mergedAt('2026-01-05T10:00:00Z'));
  const other: RepositoryRef = { host: 'github', owner: 'acme', name: 'other' };

  const result = await queryMetric({ ...ports, repositories: new InMemoryRepositoryFinder(other) }, request(), now);

  expect(result.rows[0]).toEqual({ period: '2026-01', n: 0, value: 0 });
});

test('rangeDefaultsToTheLast90DaysEndingToday', async () => {
  const ports = portsWith();

  const result = await queryMetric(
    ports,
    request({ since: undefined, until: undefined }),
    now,
  );

  expect(result.range).toEqual({ since: '2025-12-21', until: '2026-03-20' });
});

test('onlySinceGiven_untilDefaultsToToday', async () => {
  const ports = portsWith();

  const result = await queryMetric(ports, request({ until: undefined }), now);

  expect(result.range).toEqual({ since: '2026-01-01', until: '2026-03-20' });
});

test('unknownMetricIsAUsageError', async () => {
  const ports = portsWith();

  const result = queryMetric(ports, request({ metric: 'nope' }), now);

  await expect(result).rejects.toThrow(new UsageError('Unknown metric "nope" for family "pr". Available: prsMerged, reviewWaitingTime, totalReviewTime'));
});

test('unsupportedStatisticIsAUsageError', async () => {
  const ports = portsWith();

  const result = queryMetric(ports, request({ statistic: 'mean' }), now);

  await expect(result).rejects.toThrow(
    new UsageError('Metric "prsMerged" does not support statistic "mean". Allowed: total'),
  );
});

test('unsupportedPeriodIsAUsageError', async () => {
  const ports = portsWith();

  const result = queryMetric(ports, request({ period: 'hourly' }), now);

  await expect(result).rejects.toThrow(new UsageError('Unsupported period "hourly". Allowed: monthly'));
});

test('malformedDateIsAUsageError', async () => {
  const ports = portsWith();

  const result = queryMetric(ports, request({ since: '2026-1-1' }), now);

  await expect(result).rejects.toThrow(new UsageError('Invalid date "2026-1-1". Use YYYY-MM-DD'));
});

test('impossibleDateIsAUsageError', async () => {
  const ports = portsWith();

  const result = queryMetric(ports, request({ until: '2026-02-30' }), now);

  await expect(result).rejects.toThrow(new UsageError('Invalid date "2026-02-30". Use YYYY-MM-DD'));
});

test('sinceAfterUntilIsAUsageError', async () => {
  const ports = portsWith();

  const result = queryMetric(
    ports,
    request({ since: '2026-03-02', until: '2026-03-01' }),
    now,
  );

  await expect(result).rejects.toThrow(new UsageError('--since 2026-03-02 is after --until 2026-03-01'));
});

test('listMetricsDescribesRegisteredMetricsWithTheirStatistics', () => {
  const metrics = listMetrics();

  expect(metrics).toEqual([
    { family: 'pr', id: 'prsMerged', description: 'Pull requests merged per period', statistics: ['total'] },
    {
      family: 'pr',
      id: 'reviewWaitingTime',
      description: 'Hours from ready for review to first response',
      statistics: ['median', 'p90'],
    },
    {
      family: 'pr',
      id: 'totalReviewTime',
      description: 'Hours from ready for review to merge',
      statistics: ['median', 'p90'],
    },
  ]);
});

test('dataErrorIsNotAUsageErrorSoExitCodesCanDiffer', () => {
  const error = new DataError('gh missing');

  expect(error instanceof UsageError).toBe(false);
});

test('usageMistakeIsReportedBeforeTheRepositoryIsLookedUp', async () => {
  const ports = { ...portsWith(), repositories: { current: () => Promise.reject(new DataError('not a repository')) } };

  const result = queryMetric(ports, request({ metric: 'nope' }), now);

  await expect(result).rejects.toThrow(UsageError);
});
