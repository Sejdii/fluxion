import { expect, test } from 'vitest';
import {
  CachingPullRequestSource,
  DataError,
  IN_PROGRESS_TTL_MINUTES,
  InMemoryCache,
  InMemoryPullRequestSource,
  type DateRange,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const range: DateRange = { since: '2026-01-01', until: '2026-01-31' };

function pullRequest(number: number, mergedAt = '2026-01-10T00:00:00Z'): PullRequestActivity {
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

function decorate(source: PullRequestSource): CachingPullRequestSource {
  return new CachingPullRequestSource(source, new InMemoryCache());
}

test('shouldFetchEachCalendarMonthOfARangeSeparately', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);

  await caching.mergedPullRequests(repository, { since: '2026-01-15', until: '2026-03-10' });

  expect(source.requested).toEqual([
    { since: '2026-01-15', until: '2026-01-31' },
    { since: '2026-02-01', until: '2026-02-28' },
    { since: '2026-03-01', until: '2026-03-10' },
  ]);
});

test('shouldReturnEveryPullRequestOnceAcrossMonthEdges', async () => {
  const source = new InMemoryPullRequestSource();
  source.set(repository, [
    pullRequest(1, '2026-01-31T23:59:59Z'),
    pullRequest(2, '2026-02-01T00:00:00Z'),
    pullRequest(3, '2026-02-28T23:59:59Z'),
    pullRequest(4, '2026-03-01T00:00:00Z'),
  ]);

  const found = await decorate(source).mergedPullRequests(repository, { since: '2026-01-01', until: '2026-03-31' });

  expect(found.map((pr) => pr.number)).toEqual([1, 2, 3, 4]);
});

test('shouldReuseClosedMonthsWhenTheRangeShifts', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, { since: '2026-01-01', until: '2026-03-31' });
  source.requested.length = 0;

  await caching.mergedPullRequests(repository, { since: '2026-02-01', until: '2026-04-30' });

  expect(source.requested).toEqual([{ since: '2026-04-01', until: '2026-04-30' }]);
});

test('shouldReuseClosedMonthsWhenTheRangesOverlap', async () => {
  const source = new InMemoryPullRequestSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, { since: '2026-01-01', until: '2026-02-28' });
  source.requested.length = 0;

  await caching.mergedPullRequests(repository, { since: '2026-01-01', until: '2026-03-31' });

  expect(source.requested).toEqual([{ since: '2026-03-01', until: '2026-03-31' }]);
});

const today = { since: '2026-05-01', until: '2026-05-20' };

function clocked(): { source: InMemoryPullRequestSource; caching: CachingPullRequestSource; advance(minutes: number): void } {
  let now = new Date('2026-05-20T12:00:00Z');
  const source = new InMemoryPullRequestSource();
  const caching = new CachingPullRequestSource(source, new InMemoryCache(), () => now);
  return { source, caching, advance: (minutes) => void (now = new Date(now.getTime() + minutes * 60_000)) };
}

test('monthInProgressShouldServeFromCacheWithinTheTimeToLive', async () => {
  const { source, caching, advance } = clocked();
  await caching.mergedPullRequests(repository, today);

  advance(IN_PROGRESS_TTL_MINUTES - 1);
  await caching.mergedPullRequests(repository, today);

  expect(source.fetches).toBe(1);
});

test('monthInProgressShouldRefetchOnceTheTimeToLiveHasPassed', async () => {
  const { source, caching, advance } = clocked();
  await caching.mergedPullRequests(repository, today);

  advance(IN_PROGRESS_TTL_MINUTES + 1);
  await caching.mergedPullRequests(repository, today);

  expect(source.fetches).toBe(2);
});

test('monthInProgressShouldKeepAClosedMonthForeverEvenWhenTheMonthInProgressExpires', async () => {
  const { source, caching, advance } = clocked();
  const range = { since: '2026-04-01', until: '2026-05-20' };
  await caching.mergedPullRequests(repository, range);
  source.requested.length = 0;

  advance(24 * 60);
  await caching.mergedPullRequests(repository, range);

  expect(source.requested).toEqual([{ since: '2026-05-01', until: '2026-05-20' }]);
});

class LimitedSource implements PullRequestSource {
  active = 0;
  peak = 0;

  constructor(private readonly inner: PullRequestSource, private readonly limit = Infinity) {}

  async mergedPullRequests(repo: RepositoryRef, requested: DateRange): Promise<PullRequestActivity[]> {
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.active -= 1;
    const found = await this.inner.mergedPullRequests(repo, requested);
    if (found.length > this.limit) throw new DataError(`more than ${this.limit} merged pull requests`);
    return found;
  }

  pullRequest(repo: RepositoryRef, number: number): Promise<FetchedPullRequest | null> {
    return this.inner.pullRequest(repo, number);
  }
}

test('shouldFetchAtMostThreeMonthsAtOnce', async () => {
  const source = new LimitedSource(new InMemoryPullRequestSource());

  await decorate(source).mergedPullRequests(repository, { since: '2025-01-01', until: '2025-12-31' });

  expect(source.peak).toBe(3);
});

test('shouldSucceedWhenTheRangeExceedsTheSearchLimitButNoMonthDoes', async () => {
  const inner = new InMemoryPullRequestSource();
  const perMonth = 600;
  inner.set(
    repository,
    ['2026-01', '2026-02', '2026-03'].flatMap((month, index) =>
      Array.from({ length: perMonth }, (_, n) => pullRequest(index * perMonth + n, `${month}-10T00:00:00Z`)),
    ),
  );
  const source = new LimitedSource(inner, 1000);

  const found = await decorate(source).mergedPullRequests(repository, { since: '2026-01-01', until: '2026-03-31' });

  expect(found).toHaveLength(3 * perMonth);
});

test('shouldStillFailWhenASingleMonthExceedsTheSearchLimit', async () => {
  const inner = new InMemoryPullRequestSource();
  inner.set(repository, Array.from({ length: 1001 }, (_, n) => pullRequest(n)));

  await expect(decorate(new LimitedSource(inner, 1000)).mergedPullRequests(repository, range)).rejects.toBeInstanceOf(DataError);
});
