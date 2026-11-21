import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  explainPullRequest,
  queryMetric,
  type Actor,
  type FetchedPullRequest,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const author: Actor = { login: 'ann', isBot: false };
const bob: Actor = { login: 'bob', isBot: false };
const buildBot: Actor = { login: 'ci', isBot: true };

function pullRequest(overrides: Partial<FetchedPullRequest> = {}): FetchedPullRequest {
  return {
    number: 7,
    author,
    createdAt: '2026-01-05T08:00:00Z',
    mergedAt: '2026-01-05T18:00:00Z',
    additions: 30,
    deletions: 12,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
    ...overrides,
  };
}

function explain(number: number, ...pullRequests: FetchedPullRequest[]) {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  return explainPullRequest({ pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) }, { number });
}

test('explainsEveryMetricValueOfAMergedPullRequest', async () => {
  const pr = pullRequest({ comments: [{ actor: bob, at: '2026-01-05T10:00:00Z' }] });

  const explanation = await explain(7, pr);

  expect(explanation.values).toEqual([
    { metric: 'prsMerged', value: 1 },
    { metric: 'reviewWaitingTime', unit: 'hours', value: 2 },
    { metric: 'totalReviewTime', unit: 'hours', value: 10 },
    { metric: 'prSize', unit: 'lines', value: 42 },
    { metric: 'comments', value: 1 },
    { metric: 'reviewers', value: 1 },
  ]);
});

test('showsWhenThePullRequestWasReadyForReviewAfterADraft', async () => {
  const pr = pullRequest({ draftEvents: [{ kind: 'ready_for_review', at: '2026-01-05T09:00:00Z' }] });

  const explanation = await explain(7, pr);

  expect(explanation.facts.readyForReviewAt).toBe('2026-01-05T09:00:00Z');
});

test('showsWhoGaveTheFirstResponseAndWhen', async () => {
  const pr = pullRequest({ comments: [{ actor: bob, at: '2026-01-05T10:00:00Z' }] });

  const explanation = await explain(7, pr);

  expect(explanation.facts.firstResponse).toEqual({ kind: 'human', by: 'bob', at: '2026-01-05T10:00:00Z' });
});

test('showsTheMergeAsFirstResponseWhenNoHumanResponded', async () => {
  const pr = pullRequest({ comments: [{ actor: buildBot, at: '2026-01-05T10:00:00Z' }] });

  const explanation = await explain(7, pr);

  expect(explanation.facts.firstResponse).toEqual({ kind: 'merge', at: '2026-01-05T18:00:00Z' });
});

test('countsOnlyHumanCommentsAndReviewers', async () => {
  const pr = pullRequest({
    comments: [
      { actor: bob, at: '2026-01-05T10:00:00Z' },
      { actor: buildBot, at: '2026-01-05T10:05:00Z' },
      { actor: author, at: '2026-01-05T11:00:00Z' },
    ],
  });

  const explanation = await explain(7, pr);

  expect(explanation.facts).toMatchObject({ comments: 2, reviewers: ['bob'] });
});

test('unmergedPullRequestPrintsItsFactsAndNoValues', async () => {
  const pr = pullRequest({ mergedAt: null, comments: [{ actor: bob, at: '2026-01-05T10:00:00Z' }] });

  const explanation = await explain(7, pr);

  expect(explanation).toMatchObject({
    number: 7,
    merged: false,
    values: null,
    facts: { mergedAt: null, firstResponse: { kind: 'human', by: 'bob', at: '2026-01-05T10:00:00Z' }, comments: 1, reviewers: ['bob'] },
  });
});

test('unmergedPullRequestWithoutResponseHasNoFirstResponse', async () => {
  const explanation = await explain(7, pullRequest({ mergedAt: null }));

  expect(explanation.facts.firstResponse).toBeNull();
});

test('unknownPullRequestNumberIsADataError', async () => {
  await expect(explain(99, pullRequest())).rejects.toThrow(DataError);
});

test('repositoryWithoutDataIsADataError', async () => {
  const ports = { pullRequests: new InMemoryPullRequestSource(), repositories: new InMemoryRepositoryFinder(repository) };

  await expect(explainPullRequest(ports, { number: 7 })).rejects.toThrow(DataError);
});

test('showsADeletedAccountAsTheFirstResponder', async () => {
  const pr = pullRequest({ comments: [{ actor: null, at: '2026-01-05T10:00:00Z' }] });

  const explanation = await explain(7, pr);

  expect(explanation.facts.firstResponse).toEqual({ kind: 'human', by: null, at: '2026-01-05T10:00:00Z' });
});

test('unmergedPullRequestsAreNotCountedInRangeQueries', async () => {
  const source = new InMemoryPullRequestSource();
  source.set(repository, [pullRequest({ mergedAt: null })]);
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };

  const result = await queryMetric(
    ports,
    { family: 'pr', metric: 'prsMerged', statistic: 'total', period: 'overall', since: '2026-01-01', until: '2026-01-31' },
    new Date('2026-02-01T00:00:00Z'),
  );

  expect(result.rows[0]?.value).toBe(0);
});
