import { expect, test } from 'vitest';
import {
  DataError,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  explainPullRequest,
  type Actor,
  type ExplainRequest,
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
  return explainWith({ number }, ...pullRequests);
}

function explainWith(request: ExplainRequest, ...pullRequests: FetchedPullRequest[]) {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  return explainPullRequest({ pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) }, request);
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

const humanAndBotComments = pullRequest({
  comments: [
    { actor: bob, at: '2026-01-05T10:00:00Z' },
    { actor: buildBot, at: '2026-01-05T10:05:00Z' },
    { actor: author, at: '2026-01-05T11:00:00Z' },
  ],
});

test('countsHumanCommentsIncludingTheAuthorsButNotBots', async () => {
  const explanation = await explain(7, humanAndBotComments);

  expect(explanation.facts.comments).toBe(2);
});

test('listsHumanReviewersExcludingTheAuthorAndBots', async () => {
  const explanation = await explain(7, humanAndBotComments);

  expect(explanation.facts.reviewers).toEqual(['bob']);
});

const unmergedWithComment = pullRequest({ mergedAt: null, comments: [{ actor: bob, at: '2026-01-05T10:00:00Z' }] });

test('unmergedPullRequestHasNoValues', async () => {
  const explanation = await explain(7, unmergedWithComment);

  expect(explanation.values).toBeNull();
});

test('unmergedPullRequestStillShowsItsFacts', async () => {
  const explanation = await explain(7, unmergedWithComment);

  expect(explanation.facts).toEqual({
    readyForReviewAt: '2026-01-05T08:00:00Z',
    firstResponse: { kind: 'human', by: 'bob', at: '2026-01-05T10:00:00Z' },
    mergedAt: null,
    comments: 1,
    reviewers: ['bob'],
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

  expect(explanation.facts.firstResponse).toEqual({ kind: 'human', by: '(deleted account)', at: '2026-01-05T10:00:00Z' });
});

const schedule = { days: ['mon' as const, 'tue' as const], start: '09:00', end: '17:00', timeZone: 'UTC' };

test('withAScheduleDurationsAndTheFirstResponseAreInWorkingTime', async () => {
  const pr = pullRequest({ comments: [{ actor: bob, at: '2026-01-05T10:00:00Z' }] });

  const explanation = await explainWith({ number: 7, workSchedule: schedule }, pr);

  expect(explanation).toMatchObject({
    workSchedule: schedule,
    facts: { readyForReviewAt: '2026-01-05T08:00:00Z', firstResponseWorkingHours: 1, mergedAt: '2026-01-05T18:00:00Z' },
  });
  expect(explanation.values).toContainEqual({ metric: 'totalReviewTime', unit: 'hours', value: 8 });
});

test('withoutAScheduleTheExplanationCarriesNoWorkingTimeFields', async () => {
  const explanation = await explain(7, pullRequest());

  expect('workSchedule' in explanation).toBe(false);
  expect('firstResponseWorkingHours' in explanation.facts).toBe(false);
});

test('withAScheduleAnUnmergedPullRequestWithoutAResponseHasNoWorkingHoursToIt', async () => {
  const explanation = await explainWith({ number: 7, workSchedule: schedule }, pullRequest({ mergedAt: null }));

  expect(explanation.facts.firstResponse).toBeNull();
  expect('firstResponseWorkingHours' in explanation.facts).toBe(false);
});

test('workingHoursToFirstResponseAreRounded', async () => {
  const pr = pullRequest({ comments: [{ actor: bob, at: '2026-01-05T09:20:00Z' }] });

  const explanation = await explainWith({ number: 7, workSchedule: schedule }, pr);

  expect(explanation.facts.firstResponseWorkingHours).toBe(0.33);
});

test('theMergeCountsAsTheFirstResponseForWorkingHours', async () => {
  const explanation = await explainWith({ number: 7, workSchedule: schedule }, pullRequest());

  expect(explanation.facts).toMatchObject({ firstResponse: { kind: 'merge' }, firstResponseWorkingHours: 8 });
});

test('aResponseOutsideWorkingTimeIsZeroWorkingHours', async () => {
  const pr = pullRequest({ createdAt: '2026-01-10T08:00:00Z', mergedAt: '2026-01-10T18:00:00Z' });

  const explanation = await explainWith({ number: 7, workSchedule: schedule }, pr);

  expect(explanation.facts.firstResponseWorkingHours).toBe(0);
});
