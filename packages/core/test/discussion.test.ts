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
const bob: Actor = { login: 'bob', isBot: false };
const carol: Actor = { login: 'carol', isBot: false };
const bot: Actor = { login: 'ci', isBot: true };
const at = '2026-01-05T10:00:00Z';

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
    reviewComments: [],
    reviews: [],
    ...overrides,
  };
}

async function january(metric: string, statistic: string, ...pullRequests: PullRequestActivity[]) {
  const source = new InMemoryPullRequestSource();
  source.set(repository, pullRequests);
  const ports = { pullRequests: source, repositories: new InMemoryRepositoryFinder(repository) };
  const request = { family: 'pr', metric, statistic, period: 'monthly', since: '2026-01-01', until: '2026-01-31' };
  return (await queryMetric(ports, request, now)).rows[0];
}

const size = (...prs: PullRequestActivity[]) => january('prSize', 'median', ...prs);
const comments = (...prs: PullRequestActivity[]) => january('comments', 'median', ...prs);
const reviewers = (...prs: PullRequestActivity[]) => january('reviewers', 'median', ...prs);

test('prSizeIsAdditionsPlusDeletions', async () => {
  expect((await size(pullRequest({ additions: 30, deletions: 12 })))?.value).toBe(42);
});

test('prSizeHasMedianAndP90', async () => {
  const prs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100].map((additions, i) => pullRequest({ number: i, additions, deletions: 0 }));

  expect((await january('prSize', 'median', ...prs))?.value).toBe(5.5);
  expect((await january('prSize', 'p90', ...prs))?.value).toBe(9);
});

test('commentsCountIssueCommentsAndInlineReviewComments', async () => {
  const pr = pullRequest({
    comments: [{ actor: bob, at }],
    reviewComments: [{ actor: bob, at }, { actor: carol, at }],
  });

  expect((await comments(pr))?.value).toBe(3);
});

test('commentsCountNonEmptyReviewBodiesOnly', async () => {
  const pr = pullRequest({
    reviews: [
      { actor: bob, at, hasBody: true },
      { actor: carol, at, hasBody: false },
    ],
  });

  expect((await comments(pr))?.value).toBe(1);
});

test('commentsIncludeTheAuthorsReplies', async () => {
  const pr = pullRequest({ comments: [{ actor: author, at }], reviewComments: [{ actor: author, at }] });

  expect((await comments(pr))?.value).toBe(2);
});

test('commentsExcludeBots', async () => {
  const pr = pullRequest({
    comments: [{ actor: bot, at }],
    reviewComments: [{ actor: bot, at }],
    reviews: [{ actor: bot, at, hasBody: true }],
  });

  expect((await comments(pr))?.value).toBe(0);
});

test('commentsFromDeletedAccountsCountAsHuman', async () => {
  expect((await comments(pullRequest({ comments: [{ actor: null, at }] })))?.value).toBe(1);
});

test('reviewersAreDistinctHumansWhoRespondedByAnyRoute', async () => {
  const pr = pullRequest({
    comments: [{ actor: bob, at }, { actor: bob, at }],
    reviewComments: [{ actor: carol, at }],
    reviews: [{ actor: bob, at, hasBody: false }],
  });

  expect((await reviewers(pr))?.value).toBe(2);
});

test('reviewersExcludeTheAuthor', async () => {
  const pr = pullRequest({ comments: [{ actor: author, at }, { actor: bob, at }] });

  expect((await reviewers(pr))?.value).toBe(1);
});

test('reviewersExcludeBots', async () => {
  const pr = pullRequest({ comments: [{ actor: bot, at }], reviews: [{ actor: bot, at, hasBody: false }] });

  expect((await reviewers(pr))?.value).toBe(0);
});

test('anApprovalWithoutBodyMakesAReviewerButNotAComment', async () => {
  const pr = pullRequest({ reviews: [{ actor: bob, at, hasBody: false }] });

  expect((await reviewers(pr))?.value).toBe(1);
  expect((await comments(pr))?.value).toBe(0);
});

test('requestedButSilentPeopleAreNotReviewers', async () => {
  expect((await reviewers(pullRequest()))?.value).toBe(0);
});

test('reviewersHaveP90', async () => {
  const prs = Array.from({ length: 10 }, (_, i) => pullRequest({ number: i, comments: Array.from({ length: i + 1 }, (_, j) => ({ actor: { login: `u${j}`, isBot: false }, at })) }));

  expect((await january('reviewers', 'p90', ...prs))?.value).toBe(9);
});

test('deletedAccountsCountAsOneReviewer', async () => {
  const pr = pullRequest({ comments: [{ actor: null, at }, { actor: null, at }] });

  expect((await reviewers(pr))?.value).toBe(1);
});
