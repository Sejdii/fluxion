import { expect, test } from 'vitest';
import {
  CachingPullRequestSource,
  IN_PROGRESS_TTL_MINUTES,
  InMemoryCache,
  InMemoryPullRequestSource,
  type DateRange,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const mayToDate: DateRange = { since: '2026-05-01', until: '2026-05-20' };
const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

function startedAtNoonOn20May(): { source: InMemoryPullRequestSource; caching: CachingPullRequestSource; advance(minutes: number): void } {
  let now = new Date('2026-05-20T12:00:00Z');
  const source = new InMemoryPullRequestSource();
  const caching = new CachingPullRequestSource(source, new InMemoryCache(), () => now);
  return { source, caching, advance: (minutes) => void (now = new Date(now.getTime() + minutes * MINUTE_MS)) };
}

test('shouldServeTheMonthInProgressFromCacheWithinTheTimeToLive', async () => {
  const { source, caching, advance } = startedAtNoonOn20May();
  await caching.mergedPullRequests(repository, mayToDate);

  advance(IN_PROGRESS_TTL_MINUTES - 1);
  await caching.mergedPullRequests(repository, mayToDate);

  expect(source.fetches).toBe(1);
});

test('shouldRefetchTheMonthInProgressOnceTheTimeToLiveHasPassed', async () => {
  const { source, caching, advance } = startedAtNoonOn20May();
  await caching.mergedPullRequests(repository, mayToDate);

  advance(IN_PROGRESS_TTL_MINUTES + 1);
  await caching.mergedPullRequests(repository, mayToDate);

  expect(source.fetches).toBe(2);
});

test('shouldKeepAMonthThatWasFetchedAfterItEnded', async () => {
  const { source, caching, advance } = startedAtNoonOn20May();
  const april = { since: '2026-04-01', until: '2026-04-30' };
  await caching.mergedPullRequests(repository, april);

  advance(DAY_MINUTES);
  await caching.mergedPullRequests(repository, april);

  expect(source.fetches).toBe(1);
});

test('shouldRefetchAMonthThatWasFetchedBeforeItEndedEvenAfterItHasEnded', async () => {
  const { source, caching, advance } = startedAtNoonOn20May();
  await caching.mergedPullRequests(repository, mayToDate);

  advance(15 * DAY_MINUTES);
  await caching.mergedPullRequests(repository, mayToDate);

  expect(source.fetches).toBe(2);
});

test('shouldReuseTheMonthInProgressWhenTheRangeEndsOnALaterDay', async () => {
  const { source, caching, advance } = startedAtNoonOn20May();
  await caching.mergedPullRequests(repository, mayToDate);

  advance(IN_PROGRESS_TTL_MINUTES - 1);
  await caching.mergedPullRequests(repository, { since: '2026-05-01', until: '2026-05-21' });

  expect(source.fetches).toBe(1);
});
