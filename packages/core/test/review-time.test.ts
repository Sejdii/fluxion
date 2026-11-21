import { expect, test } from 'vitest';
import {
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  queryMetric,
  type Actor,
  type PullRequestActivity,
  type RepositoryRef,
} from '../src/index.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const now = new Date('2026-03-20T10:00:00Z');
const author: Actor = { login: 'ann', isBot: false };
const reviewer: Actor = { login: 'bob', isBot: false };

function pullRequest(overrides: Partial<PullRequestActivity> = {}): PullRequestActivity {
  return {
    number: 1,
    author,
    createdAt: '2026-01-05T08:00:00Z',
    mergedAt: '2026-01-05T18:00:00Z',
    additions: 1,
    deletions: 1,
    draftEvents: [],
    comments: [],
    reviews: [],
    ...overrides,
  };
}

function withHoursToFirstResponse(hours: number, number: number): PullRequestActivity {
  const at = new Date(Date.parse('2026-01-05T08:00:00Z') + hours * 3_600_000).toISOString();
  return pullRequest({ number, comments: [{ actor: reviewer, at }] });
}

async function january(statistic: string, metric: string, ...pullRequests: PullRequestActivity[]) {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
  const result = await queryMetric(ports, { family: 'pr', metric, statistic, period: 'monthly', since: '2026-01-01', until: '2026-01-31' }, now);
  return result.rows[0];
}

const waiting = (statistic: string, ...prs: PullRequestActivity[]) => january(statistic, 'reviewWaitingTime', ...prs);
const total = (statistic: string, ...prs: PullRequestActivity[]) => january(statistic, 'totalReviewTime', ...prs);

test('waitingTimeRunsFromCreationToFirstHumanComment', async () => {
  const pr = pullRequest({ comments: [{ actor: reviewer, at: '2026-01-05T10:00:00Z' }] });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(2);
});

test('waitingTimeEndsAtFirstHumanReview', async () => {
  const pr = pullRequest({ reviews: [{ actor: reviewer, at: '2026-01-05T09:00:00Z' }] });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(1);
});

test('earliestOfCommentsAndReviewsEndsTheWait', async () => {
  const pr = pullRequest({
    comments: [{ actor: reviewer, at: '2026-01-05T12:00:00Z' }],
    reviews: [{ actor: reviewer, at: '2026-01-05T09:00:00Z' }],
  });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(1);
});

test('pullRequestWithoutHumanResponseUsesTheMergeAsFirstResponse', async () => {
  const row = await waiting('median', pullRequest());

  expect(row?.value).toBe(10);
});

test('botActivityNeverCountsAsAResponse', async () => {
  const bot: Actor = { login: 'dependabot', isBot: true };
  const pr = pullRequest({ comments: [{ actor: bot, at: '2026-01-05T09:00:00Z' }] });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(10);
});

test('authorActivityNeverCountsAsAResponse', async () => {
  const pr = pullRequest({
    comments: [{ actor: author, at: '2026-01-05T09:00:00Z' }],
    reviews: [{ actor: author, at: '2026-01-05T09:30:00Z' }],
  });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(10);
});

test('deletedAccountCountsAsAHumanReviewer', async () => {
  const pr = pullRequest({ comments: [{ actor: null, at: '2026-01-05T09:00:00Z' }] });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(1);
});

test('pullRequestWithDeletedAuthorStillCountsOtherHumans', async () => {
  const pr = pullRequest({ author: null, comments: [{ actor: reviewer, at: '2026-01-05T09:00:00Z' }] });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(1);
});

test('waitingStartsWhenTheDraftBecomesReady', async () => {
  const pr = pullRequest({
    draftEvents: [{ kind: 'ready_for_review', at: '2026-01-05T12:00:00Z' }],
    comments: [{ actor: reviewer, at: '2026-01-05T13:00:00Z' }],
  });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(1);
});

test('responseDuringTheDraftPhaseDoesNotEndTheWait', async () => {
  const pr = pullRequest({
    draftEvents: [{ kind: 'ready_for_review', at: '2026-01-05T12:00:00Z' }],
    comments: [{ actor: reviewer, at: '2026-01-05T10:00:00Z' }],
  });

  const row = await waiting('median', pr);

  expect(row?.value).toBe(6);
});

test('draftTimeIsNotCountedInTotalReviewTime', async () => {
  const pr = pullRequest({ draftEvents: [{ kind: 'ready_for_review', at: '2026-01-05T12:00:00Z' }] });

  const row = await total('median', pr);

  expect(row?.value).toBe(6);
});

test('laterReturnToDraftDoesNotMoveTheStart', async () => {
  const pr = pullRequest({
    draftEvents: [
      { kind: 'converted_to_draft', at: '2026-01-05T10:00:00Z' },
      { kind: 'ready_for_review', at: '2026-01-05T12:00:00Z' },
    ],
  });

  const row = await total('median', pr);

  expect(row?.value).toBe(10);
});

test('totalReviewTimeRunsFromCreationToMerge', async () => {
  const row = await total('median', pullRequest());

  expect(row?.value).toBe(10);
});

test('medianOfAnEvenCountAveragesTheMiddleTwo', async () => {
  const prs = [1, 2, 3, 4, 5, 6].map((hours, index) => withHoursToFirstResponse(hours, index));

  const row = await waiting('median', ...prs);

  expect(row?.value).toBe(3.5);
});

test('p90IsTheValueNinetyPercentStayAtOrBelow', async () => {
  const prs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((hours, index) => withHoursToFirstResponse(hours, index));

  const row = await waiting('p90', ...prs);

  expect(row?.value).toBe(9);
});

test('lowSamplePeriodFlagsTheMedian', async () => {
  const prs = [1, 2, 3, 4].map((hours, index) => withHoursToFirstResponse(hours, index));

  const row = await waiting('median', ...prs);

  expect(row).toEqual({ period: '2026-01', n: 4, value: 2.5, lowSample: true });
});

test('lowSamplePeriodHasNoP90', async () => {
  const prs = [1, 2, 3, 4].map((hours, index) => withHoursToFirstResponse(hours, index));

  const row = await waiting('p90', ...prs);

  expect(row?.value).toBeNull();
});

test('periodWithFiveMergedPrsIsNotFlaggedAndHasP90', async () => {
  const prs = [1, 2, 3, 4, 5].map((hours, index) => withHoursToFirstResponse(hours, index));

  const row = await waiting('p90', ...prs);

  expect(row).toEqual({ period: '2026-01', n: 5, value: 5 });
});

test('emptyPeriodHasNoValue', async () => {
  const row = await waiting('median');

  expect(row?.value).toBeNull();
});
