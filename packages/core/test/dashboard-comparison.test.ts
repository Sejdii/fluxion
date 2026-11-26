import { expect, test } from 'vitest';
import {
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  parseComparisonMode,
  queryDashboard,
  UsageError,
  type ComparisonMode,
  type DashboardProgress,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'app' };
const now = new Date('2026-03-20T10:00:00Z');

function run(compare?: ComparisonMode) {
  const source = new InMemoryPullRequestSource();
  const reported: DashboardProgress[] = [];
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
  const request = { family: 'pr', period: 'monthly', since: '2026-02-01', until: '2026-03-20', ...(compare ? { compare } : {}) };
  const dashboard = queryDashboard(ports, request, now, (progress) => reported.push(progress));
  return { source, reported, dashboard };
}

test('neverFetchesNothingFromThePreviousRange', async () => {
  const { source, dashboard } = run('never');

  await dashboard;

  expect(source.requested).toEqual([{ since: '2026-02-01', until: '2026-03-20' }]);
});

test('neverSaysThatTheComparisonWasTurnedOff', async () => {
  const overview = await run('never').dashboard;

  expect(overview.metrics.map((metric) => metric.tiles.previous)).toEqual(Array(6).fill({ skipped: 'turnedOff' }));
});

test('neverCountsOnlyTheMonthsOfTheSelectedRangeInTheProgressTotal', async () => {
  const { reported, dashboard } = run('never');

  await dashboard;

  expect(reported[0]).toEqual({ fetchedMonths: 0, totalMonths: 2 });
});

test('withoutAModeThePreviousRangeIsCompared', async () => {
  const overview = await run().dashboard;

  expect(overview.metrics[0]?.tiles.previous).toEqual({ n: 0, values: { total: 0 } });
});

test('anUnknownModeIsAUsageError', () => {
  expect(() => parseComparisonMode('sometimes')).toThrow(new UsageError('Unknown comparison mode "sometimes". Use always, never'));
});
