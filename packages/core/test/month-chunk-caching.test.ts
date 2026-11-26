import { expect, test } from 'vitest';
import {
  CachingPullRequestSource,
  DataError,
  InMemoryCache,
  InMemoryPullRequestSource,
  type DateRange,
  type PullRequestActivity,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'app' };
const firstQuarter: DateRange = { since: '2026-01-01', until: '2026-03-31' };

function pullRequest(number: number, mergedAt: string): PullRequestActivity {
  return {
    number,
    author: null,
    createdAt: '2026-01-01T00:00:00Z',
    mergedAt,
    additions: 1,
    deletions: 1,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
  };
}

function monthOf(month: string, lastDay: string): DateRange {
  return { since: `${month}-01`, until: `${month}-${lastDay}` };
}

function decorate(source: InMemoryPullRequestSource): CachingPullRequestSource {
  return new CachingPullRequestSource(source, new InMemoryCache());
}

test('shouldFetchEachWholeCalendarMonthTheRangeTouches', async () => {
  const source = new InMemoryPullRequestSource();

  await decorate(source).mergedPullRequests(repository, { since: '2026-01-15', until: '2026-03-10' });

  expect(source.requested).toEqual([monthOf('2026-01', '31'), monthOf('2026-02', '28'), monthOf('2026-03', '31')]);
});

test('shouldReturnOnlyPullRequestsMergedInsideTheRange', async () => {
  const source = new InMemoryPullRequestSource();
  source.set(repository, [
    pullRequest(1, '2026-01-14T23:59:59Z'),
    pullRequest(2, '2026-01-15T00:00:00Z'),
    pullRequest(3, '2026-03-10T23:59:59Z'),
    pullRequest(4, '2026-03-11T00:00:00Z'),
  ]);

  const found = await decorate(source).mergedPullRequests(repository, { since: '2026-01-15', until: '2026-03-10' });

  expect(found.map((pr) => pr.number)).toEqual([2, 3]);
});

test('shouldReturnEveryPullRequestOnceAcrossMonthEdges', async () => {
  const source = new InMemoryPullRequestSource();
  source.set(repository, [
    pullRequest(1, '2026-01-31T23:59:59Z'),
    pullRequest(2, '2026-02-01T00:00:00Z'),
    pullRequest(3, '2026-02-28T23:59:59Z'),
    pullRequest(4, '2026-03-01T00:00:00Z'),
  ]);

  const found = await decorate(source).mergedPullRequests(repository, firstQuarter);

  expect(found.map((pr) => pr.number)).toEqual([1, 2, 3, 4]);
});

test('shouldReuseEdgeMonthsWhenTheRangeShiftsByADay', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, { since: '2026-01-15', until: '2026-02-10' });
  const fetched = source.requested.length;

  await caching.mergedPullRequests(repository, { since: '2026-01-16', until: '2026-02-11' });

  expect(source.requested.slice(fetched)).toEqual([]);
});

test('shouldFetchOnlyTheMissingMonthsWhenRangesOverlap', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, { since: '2026-01-01', until: '2026-02-28' });
  const fetched = source.requested.length;

  await caching.mergedPullRequests(repository, firstQuarter);

  expect(source.requested.slice(fetched)).toEqual([monthOf('2026-03', '31')]);
});

test('shouldShareOneFetchPerMonthBetweenConcurrentCallers', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);

  await Promise.all([caching.mergedPullRequests(repository, firstQuarter), caching.mergedPullRequests(repository, firstQuarter)]);

  expect(source.fetches).toBe(3);
});

test('shouldRefetchEveryMonthAfterClear', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, firstQuarter);

  await caching.clear();
  await caching.mergedPullRequests(repository, firstQuarter);

  expect(source.fetches).toBe(6);
});

test('shouldRefetchOnlyTheMonthThatFailedOnRetry', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);
  source.failMonth('2026-02', new DataError('HTTP 502'));
  await expect(caching.mergedPullRequests(repository, firstQuarter)).rejects.toBeInstanceOf(DataError);
  const fetched = source.requested.length;
  source.failMonth('2026-02', null);

  await caching.mergedPullRequests(repository, firstQuarter);

  expect(source.requested.slice(fetched)).toEqual([monthOf('2026-02', '28')]);
});

test('shouldSucceedWhenTheRangeExceedsTheSearchLimitButNoMonthDoes', async () => {
  const source = new InMemoryPullRequestSource();
  source.limitSearchTo(1000);
  const perMonth = 600;
  source.set(
    repository,
    ['2026-01', '2026-02', '2026-03'].flatMap((month, index) =>
      Array.from({ length: perMonth }, (_, n) => pullRequest(index * perMonth + n, `${month}-10T00:00:00Z`)),
    ),
  );

  const found = await decorate(source).mergedPullRequests(repository, firstQuarter);

  expect(found).toHaveLength(3 * perMonth);
});

test('shouldStillFailWhenASingleMonthExceedsTheSearchLimit', async () => {
  const source = new InMemoryPullRequestSource();
  source.limitSearchTo(1000);
  source.set(repository, Array.from({ length: 1001 }, (_, n) => pullRequest(n, '2026-01-10T00:00:00Z')));

  await expect(decorate(source).mergedPullRequests(repository, firstQuarter)).rejects.toBeInstanceOf(DataError);
});
