import { expect, test, vi } from 'vitest';
import {
  CachingPullRequestSource,
  InMemoryCache,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  queryDashboard,
  type DashboardProgress,
  type RepositoryRef,
} from '../src/index.js';

const app: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const web: RepositoryRef = { host: 'github', owner: 'acme', name: 'web' };
const now = new Date('2026-03-20T10:00:00Z');
const request = { family: 'pr', period: 'monthly', since: '2026-02-01', until: '2026-03-20' };

function setup(...repositories: RepositoryRef[]) {
  const source = new InMemoryPullRequestSource();
  const ports = { pullRequests: new CachingPullRequestSource(source, new InMemoryCache(), () => now), repositories: new InMemoryRepositoryFinder(...repositories) };
  const reported: DashboardProgress[] = [];
  const run = (since = request.since) => queryDashboard(ports, { ...request, since }, now, (progress) => reported.push(progress));
  return { source, reported, run };
}

test('shouldReportEveryMonthOfTheRangeAndThePreviousRangeOnce', async () => {
  const { reported, run } = setup(app);

  await run();

  expect(reported.map((progress) => progress.fetchedMonths)).toEqual([0, 1, 2, 3, 4]);
  expect(reported.at(-1)).toEqual({ fetchedMonths: 4, totalMonths: 4 });
});

test('shouldReportMonthsServedFromTheCache', async () => {
  const { reported, run } = setup(app);
  await run();
  reported.length = 0;

  await run();

  expect(reported.at(-1)).toEqual({ fetchedMonths: 4, totalMonths: 4 });
});

test('shouldCountAMonthOnlyOnceEveryRepositoryHasFetchedIt', async () => {
  const { source, reported, run } = setup(app, web);
  const release = source.holdMonth(web, '2026-03');

  const pending = run();
  await vi.waitFor(() => expect(reported.at(-1)).toEqual({ fetchedMonths: 1, totalMonths: 4 }));
  release();
  await pending;

  expect(reported.at(-1)).toEqual({ fetchedMonths: 4, totalMonths: 4 });
});

test('shouldCountAMonthSharedByBothRangesOnce', async () => {
  const { reported, run } = setup(app);

  await run('2026-03-11');

  expect(reported).toEqual([
    { fetchedMonths: 0, totalMonths: 1 },
    { fetchedMonths: 1, totalMonths: 1 },
  ]);
});
