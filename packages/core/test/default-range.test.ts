import { expect, test } from 'vitest';
import {
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  queryMetric,
  type DateRange,
  type MetricRequest,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const now = new Date('2026-03-20T10:00:00Z');

async function rangeOf(overrides: Partial<MetricRequest>): Promise<DateRange> {
  const ports = { pullRequests: new InMemoryPullRequestSource(), repositories: new InMemoryRepositoryFinder(repository) };
  const request = { family: 'pr', metric: 'prsMerged', statistic: 'total', period: 'monthly', ...overrides };

  const result = await queryMetric(ports, request, now);

  return result.range;
}

test('dailyDefaultsToTheLast30DaysEndingToday', async () => {
  const range = await rangeOf({ period: 'daily' });

  expect(range).toEqual({ since: '2026-02-19', until: '2026-03-20' });
});

test('weeklyDefaultsToTheLast90DaysEndingToday', async () => {
  const range = await rangeOf({ period: 'weekly' });

  expect(range).toEqual({ since: '2025-12-21', until: '2026-03-20' });
});

test('monthlyDefaultsToTheLast12MonthsIncludingTheCurrentOne', async () => {
  const range = await rangeOf({ period: 'monthly' });

  expect(range).toEqual({ since: '2025-04-01', until: '2026-03-20' });
});

test('yearlyDefaultsToTheLast4YearsIncludingTheCurrentOne', async () => {
  const range = await rangeOf({ period: 'yearly' });

  expect(range).toEqual({ since: '2023-01-01', until: '2026-03-20' });
});

test('overallDefaultsToEveryMergedPullRequestUpToToday', async () => {
  const range = await rangeOf({ period: 'overall' });

  expect(range).toEqual({ since: '2008-01-01', until: '2026-03-20' });
});

test('defaultRangeIsRelativeToUntilWhenOnlyUntilIsGiven', async () => {
  const range = await rangeOf({ period: 'daily', until: '2026-01-31' });

  expect(range).toEqual({ since: '2026-01-02', until: '2026-01-31' });
});

test('explicitSinceOverridesThePeriodDefault', async () => {
  const range = await rangeOf({ period: 'yearly', since: '2026-01-01' });

  expect(range).toEqual({ since: '2026-01-01', until: '2026-03-20' });
});
