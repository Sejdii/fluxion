import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  queryPullRequestCount,
  type FetchedPullRequest,
  type RepositoryRef,
} from '../src/index.js';

const app: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const api: RepositoryRef = { host: 'github', owner: 'acme', name: 'api' };
const now = new Date('2026-03-20T10:00:00Z');

function mergedOn(number: number, mergedAt: string | null): FetchedPullRequest {
  return { number, author: null, createdAt: '2026-01-01T00:00:00Z', mergedAt, additions: 1, deletions: 0, draftEvents: [], comments: [], reviewComments: [], reviews: [] };
}

function ports(source: InMemoryPullRequestSource) {
  return { pullRequests: source, repositories: new InMemoryRepositoryFinder(app, api) };
}

function populatedSource(): InMemoryPullRequestSource {
  const source = new InMemoryPullRequestSource();
  source.set(app, [mergedOn(1, '2026-03-01T00:00:00Z'), mergedOn(2, '2026-03-02T00:00:00Z'), mergedOn(3, '2025-01-01T00:00:00Z'), mergedOn(4, null)]);
  source.set(api, [mergedOn(5, '2026-03-05T00:00:00Z')]);
  return source;
}

test('countsMergedPullRequestsInTheRangeAcrossRepositories', async () => {
  const result = await queryPullRequestCount(ports(populatedSource()), { since: '2026-03-01', until: '2026-03-20' }, now);

  expect(result.count).toBe(3);
});

test('countingFetchesNoPullRequests', async () => {
  const source = populatedSource();

  await queryPullRequestCount(ports(source), { since: '2026-03-01', until: '2026-03-20' }, now);

  expect(source.fetches).toBe(0);
});

test('theRangeDefaultsLikeTheDashboard', async () => {
  const result = await queryPullRequestCount(ports(new InMemoryPullRequestSource()), {}, now);

  expect(result.range).toEqual({ since: '2025-04-01', until: '2026-03-20' });
});

test('aFailureNamesTheRepository', async () => {
  const source = new InMemoryPullRequestSource();
  source.failWith(new DataError('rate limit'));

  await expect(queryPullRequestCount(ports(source), {}, now)).rejects.toThrow('acme/app: rate limit');
});

test('anUnexpectedFailureIsNotWrappedAsADataError', async () => {
  const source = new InMemoryPullRequestSource();
  source.failWith(new TypeError('boom'));

  await expect(queryPullRequestCount(ports(source), {}, now)).rejects.toThrow(TypeError);
});
