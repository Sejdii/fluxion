import { expect, test } from 'vitest';
import {
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  queryMetric,
  type MetricPorts,
  type MetricRequest,
  type PullRequestActivity,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'app' };
const now = new Date('2026-03-20T10:00:00Z');

function mergedAt(timestamp: string, number = 1, additions = 1): PullRequestActivity {
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

function request(overrides: Partial<MetricRequest> = {}): MetricRequest {
  return { family: 'pr', metric: 'prsMerged', statistic: 'total', period: 'daily', since: '2026-03-01', until: '2026-03-20', ...overrides };
}

function portsWith(...pullRequests: PullRequestActivity[]): MetricPorts {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  return { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
}

async function periodsOf(overrides: Partial<MetricRequest>, ...pullRequests: PullRequestActivity[]): Promise<string[]> {
  const result = await queryMetric(portsWith(...pullRequests), request(overrides), now);
  return result.rows.map((row) => row.period);
}

test('dailyHasOneRowPerDayOfTheRange', async () => {
  const periods = await periodsOf({ since: '2026-02-27', until: '2026-03-02' });

  expect(periods).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
});

test('dailyDayWithoutMergedPrsIsAZeroRow', async () => {
  const result = await queryMetric(portsWith(mergedAt('2026-03-01T10:00:00Z')), request({ until: '2026-03-02' }), now);

  expect(result.rows[1]).toEqual({ period: '2026-03-02', n: 0, value: 0 });
});

test('weeklyRowsAreLabelledByTheirMonday', async () => {
  const periods = await periodsOf({ period: 'weekly', since: '2026-03-04', until: '2026-03-16' });

  expect(periods).toEqual(['2026-03-02', '2026-03-09', '2026-03-16']);
});

test('weekStartsOnMondayAndSundayBelongsToThePreviousWeek', async () => {
  const sunday = mergedAt('2026-03-08T23:59:59Z', 1);
  const monday = mergedAt('2026-03-09T00:00:00Z', 2);

  const result = await queryMetric(portsWith(sunday, monday), request({ period: 'weekly', since: '2026-03-02', until: '2026-03-15' }), now);

  expect(result.rows).toEqual([
    { period: '2026-03-02', n: 1, value: 1 },
    { period: '2026-03-09', n: 1, value: 1 },
  ]);
});

test('weeklyWeekCrossesTheYearBoundary', async () => {
  const periods = await periodsOf({ period: 'weekly', since: '2026-01-01', until: '2026-01-05' });

  expect(periods).toEqual(['2025-12-29', '2026-01-05']);
});

test('yearlyHasOneRowPerYearLabelledByTheYear', async () => {
  const periods = await periodsOf({ period: 'yearly', since: '2024-06-01', until: '2026-01-01' });

  expect(periods).toEqual(['2024', '2025', '2026']);
});

test('yearlyCountsPrsByUtcYear', async () => {
  const result = await queryMetric(
    portsWith(mergedAt('2025-12-31T23:59:59Z', 1), mergedAt('2026-01-01T00:00:00Z', 2)),
    request({ period: 'yearly', since: '2025-01-01', until: '2026-01-01' }),
    now,
  );

  expect(result.rows.map((row) => row.n)).toEqual([1, 1]);
});

test('overallIsASingleRowOverTheWholeRange', async () => {
  const result = await queryMetric(
    portsWith(mergedAt('2026-03-01T10:00:00Z', 1), mergedAt('2026-03-15T10:00:00Z', 2)),
    request({ period: 'overall' }),
    now,
  );

  expect(result.rows).toEqual([{ period: 'overall', n: 2, value: 2 }]);
});

test('overallWithoutMergedPrsHasNZeroAndNoValue', async () => {
  const result = await queryMetric(portsWith(), request({ period: 'overall', metric: 'prSize', statistic: 'median' }), now);

  expect(result.rows).toEqual([{ period: 'overall', n: 0, value: null, lowSample: true }]);
});

test('overallP90IsHiddenForALowSample', async () => {
  const result = await queryMetric(
    portsWith(mergedAt('2026-03-01T10:00:00Z', 1, 10), mergedAt('2026-03-02T10:00:00Z', 2, 20)),
    request({ period: 'overall', metric: 'prSize', statistic: 'p90' }),
    now,
  );

  expect(result.rows).toEqual([{ period: 'overall', n: 2, value: null, lowSample: true }]);
});

test('theUnfinishedPeriodIsFlaggedInProgress', async () => {
  const result = await queryMetric(portsWith(), request({ period: 'monthly' }), now);

  expect(result.rows).toEqual([{ period: '2026-03', n: 0, value: 0, inProgress: true }]);
});

test('aPeriodThatEndedBeforeTodayIsNotInProgress', async () => {
  const result = await queryMetric(portsWith(), request({ period: 'monthly', since: '2026-02-01', until: '2026-02-28' }), now);

  expect(result.rows).toEqual([{ period: '2026-02', n: 0, value: 0 }]);
});

test('todayIsAnInProgressDay', async () => {
  const result = await queryMetric(portsWith(), request({ since: '2026-03-19' }), now);

  expect(result.rows.map((row) => row.inProgress)).toEqual([undefined, true]);
});

test('aWeekEndingTodayIsInProgress', async () => {
  const sunday = new Date('2026-03-22T10:00:00Z');

  const result = await queryMetric(portsWith(), request({ period: 'weekly', since: '2026-03-16', until: '2026-03-22' }), sunday);

  expect(result.rows).toEqual([{ period: '2026-03-16', n: 0, value: 0, inProgress: true }]);
});

test('aWeekEndedYesterdayIsNotInProgress', async () => {
  const monday = new Date('2026-03-23T00:00:00Z');

  const result = await queryMetric(portsWith(), request({ period: 'weekly', since: '2026-03-16', until: '2026-03-22' }), monday);

  expect(result.rows).toEqual([{ period: '2026-03-16', n: 0, value: 0 }]);
});
