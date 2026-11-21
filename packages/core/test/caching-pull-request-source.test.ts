import { expect, test } from 'vitest';
import {
  CachingPullRequestSource,
  DataError,
  InMemoryCache,
  InMemoryPullRequestSource,
  type DateRange,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const range: DateRange = { since: '2026-01-01', until: '2026-01-31' };

function pullRequest(number: number): PullRequestActivity {
  return {
    number,
    author: null,
    createdAt: '2026-01-01T00:00:00Z',
    mergedAt: '2026-01-10T00:00:00Z',
    additions: 1,
    deletions: 1,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
  };
}

class CountingSource implements PullRequestSource {
  calls = 0;
  failNext = false;
  private release: (() => void) | undefined;
  private readonly inner = new InMemoryPullRequestSource();

  constructor(private readonly gated = false) {
    this.inner.set(repository, [pullRequest(1)]);
  }

  async mergedPullRequests(repo: RepositoryRef, requested: DateRange): Promise<PullRequestActivity[]> {
    this.calls += 1;
    if (this.gated) await new Promise<void>((resolve) => (this.release = resolve));
    if (this.failNext) {
      this.failNext = false;
      throw new DataError('rate limit');
    }
    return this.inner.mergedPullRequests(repo, requested);
  }

  open(): void {
    this.release?.();
  }
}

function decorate(source: PullRequestSource): CachingPullRequestSource {
  return new CachingPullRequestSource(source, new InMemoryCache());
}

test('shouldServeRepeatedRequestForSameKeyFromCache', async () => {
  const source = new CountingSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, range);

  const again = await caching.mergedPullRequests(repository, range);

  expect(again).toHaveLength(1);
  expect(source.calls).toBe(1);
});

test('shouldFetchAgainForDifferentRange', async () => {
  const source = new CountingSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, range);

  await caching.mergedPullRequests(repository, { since: '2026-01-01', until: '2026-01-15' });

  expect(source.calls).toBe(2);
});

test('shouldFetchAgainForDifferentRepository', async () => {
  const source = new CountingSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, range);

  await caching.mergedPullRequests({ ...repository, name: 'other' }, range);

  expect(source.calls).toBe(2);
});

test('shouldShareOneFetchBetweenConcurrentCallers', async () => {
  const source = new CountingSource(true);
  const caching = decorate(source);
  const first = caching.mergedPullRequests(repository, range);
  const second = caching.mergedPullRequests(repository, range);
  await Promise.resolve();
  await Promise.resolve();

  source.open();

  expect(await first).toBe(await second);
  expect(source.calls).toBe(1);
});

test('shouldNotCacheFailures', async () => {
  const source = new CountingSource();
  const caching = decorate(source);
  source.failNext = true;
  await expect(caching.mergedPullRequests(repository, range)).rejects.toBeInstanceOf(DataError);

  const retry = await caching.mergedPullRequests(repository, range);

  expect(retry).toHaveLength(1);
  expect(source.calls).toBe(2);
});

test('shouldRefetchAfterClear', async () => {
  const source = new CountingSource();
  const caching = decorate(source);
  await caching.mergedPullRequests(repository, range);

  await caching.clear();
  await caching.mergedPullRequests(repository, range);

  expect(source.calls).toBe(2);
});
