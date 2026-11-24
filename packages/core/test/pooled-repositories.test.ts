import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  UsageError,
  explainPullRequest,
  queryMetric,
  type MetricRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '../src/index.js';

const app: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const api: RepositoryRef = { host: 'github', owner: 'acme', name: 'api' };
const now = new Date('2026-03-20T10:00:00Z');

function withSize(size: number, number: number): PullRequestActivity {
  return {
    number,
    author: { login: 'ann', isBot: false },
    createdAt: '2025-01-01T00:00:00Z',
    mergedAt: '2026-03-05T10:00:00Z',
    additions: size,
    deletions: 0,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
  };
}

function request(overrides: Partial<MetricRequest> = {}): MetricRequest {
  return { family: 'pr', metric: 'prSize', statistic: 'median', period: 'overall', since: '2026-03-01', until: '2026-03-20', ...overrides };
}

function sourceWith(app_: PullRequestActivity[], api_: PullRequestActivity[]): InMemoryPullRequestSource {
  const source = new InMemoryPullRequestSource();
  source.set(app, app_);
  source.set(api, api_);
  return source;
}

test('pooledRepositoriesAreComputedOverTheCombinedPullRequests', async () => {
  const source = sourceWith([withSize(10, 1), withSize(20, 2), withSize(30, 3)], [withSize(1000, 1)]);
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(app, api) };

  const result = await queryMetric(ports, request(), now);

  expect(result.rows[0]).toMatchObject({ n: 4, value: 25 });
});

test('failingRepositoryFailsTheQueryAndIsNamed', async () => {
  const failing: PullRequestSource = {
    mergedPullRequests: (repository) => (repository === api ? Promise.reject(new DataError('rate limit')) : Promise.resolve([])),
    countMergedPullRequests: () => Promise.resolve(0),
    pullRequest: () => Promise.resolve(null),
  };
  const ports = { pullRequests: failing, repositories: new InMemoryRepositoryFinder(app, api) };

  const result = queryMetric(ports, request(), now);

  await expect(result).rejects.toThrow('acme/api: rate limit');
});

test('unexpectedFailureOfARepositoryIsNotWrappedAsADataError', async () => {
  const crashing: PullRequestSource = {
    mergedPullRequests: () => Promise.reject(new TypeError('boom')),
    countMergedPullRequests: () => Promise.resolve(0),
    pullRequest: () => Promise.resolve(null),
  };
  const ports = { pullRequests: crashing, repositories: new InMemoryRepositoryFinder(app) };

  const result = queryMetric(ports, request(), now);

  await expect(result).rejects.toThrow(TypeError);
});

test('failureToFindRepositoriesIsNotRenamed', async () => {
  const ports = { pullRequests: sourceWith([], []), repositories: { find: () => Promise.reject(new DataError('web: no GitHub remote')) } };

  const result = queryMetric(ports, request(), now);

  await expect(result).rejects.toThrow(new DataError('web: no GitHub remote'));
});

test('explainWithSeveralRepositoriesIsAUsageError', async () => {
  const ports = { pullRequests: sourceWith([], []), repositories: new InMemoryRepositoryFinder(app, api) };

  const result = explainPullRequest(ports, { number: 1 });

  await expect(result).rejects.toThrow(new UsageError('explain works on exactly one repository, found 2: acme/app, acme/api'));
});
