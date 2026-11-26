import { expect, test, vi } from 'vitest';
import {
  CachingPullRequestSource,
  DataError,
  InMemoryCache,
  InMemoryPullRequestSource,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'app' };
const wholeYear = { since: '2025-01-01', until: '2025-12-31' };
const MAX_AT_ONCE = 3;

class GatedSource implements PullRequestSource {
  started = 0;
  private open: () => void = () => undefined;
  private readonly opened = new Promise<void>((resolve) => (this.open = resolve));

  async mergedPullRequests(): Promise<PullRequestActivity[]> {
    this.started += 1;
    await this.opened;
    return [];
  }

  countMergedPullRequests(): Promise<number> {
    return Promise.resolve(0);
  }

  pullRequest(): Promise<FetchedPullRequest | null> {
    return Promise.resolve(null);
  }

  release(): void {
    this.open();
  }
}

test('shouldFetchAtMostThreeMonthsAtOnce', async () => {
  const source = new GatedSource();
  const pending = new CachingPullRequestSource(source, new InMemoryCache()).mergedPullRequests(repository, wholeYear);

  await vi.waitFor(() => expect(source.started).toBeGreaterThanOrEqual(MAX_AT_ONCE));

  expect(source.started).toBe(MAX_AT_ONCE);
  source.release();
  await pending;
});

test('shouldFetchEveryMonthOnceTheEarlierOnesFinish', async () => {
  const source = new GatedSource();
  const pending = new CachingPullRequestSource(source, new InMemoryCache()).mergedPullRequests(repository, wholeYear);
  await vi.waitFor(() => expect(source.started).toBe(MAX_AT_ONCE));

  source.release();
  await pending;

  expect(source.started).toBe(12);
});

test('shouldNotStoreAFetchThatWasStartedBeforeClear', async () => {
  const source = new GatedSource();
  const caching = new CachingPullRequestSource(source, new InMemoryCache());
  const january = { since: '2026-01-01', until: '2026-01-31' };
  const stale = caching.mergedPullRequests(repository, january);
  await vi.waitFor(() => expect(source.started).toBe(1));

  await caching.clear();
  source.release();
  await stale;
  await caching.mergedPullRequests(repository, january);

  expect(source.started).toBe(2);
});

test('shouldStartNoFurtherMonthsOnceOneHasFailed', async () => {
  const source = new InMemoryPullRequestSource();
  source.failMonth('2025-01', new DataError('HTTP 502'));

  await expect(new CachingPullRequestSource(source, new InMemoryCache()).mergedPullRequests(repository, wholeYear)).rejects.toBeInstanceOf(DataError);

  expect(source.fetches).toBe(MAX_AT_ONCE);
});
