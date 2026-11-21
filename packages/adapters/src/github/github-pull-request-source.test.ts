import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { DataError, type RepositoryRef } from '@fluxion/core';
import { GitHubPullRequestSource } from './github-pull-request-source.js';

const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };
const range = { since: '2026-01-01', until: '2026-03-31' };
const originalPath = process.env.PATH;
let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'fluxion-gh-'));
  copyFileSync(join(import.meta.dirname, 'fake-gh.cjs'), join(workDir, 'gh'));
  chmodSync(join(workDir, 'gh'), 0o755);
  writeFileSync(join(workDir, 'log'), '');
  process.env.PATH = `${workDir}:${originalPath}`;
  process.env.FAKE_GH_LOG = join(workDir, 'log');
});

afterEach(() => {
  process.env.PATH = originalPath;
  delete process.env.FAKE_GH_PAGES;
  delete process.env.FAKE_GH_FAIL;
  rmSync(workDir, { recursive: true, force: true });
});

function node(number: number, author: { login: string; __typename: string } | null = { login: 'ann', __typename: 'User' }) {
  return { number, createdAt: '2026-01-01T00:00:00Z', mergedAt: '2026-01-02T00:00:00Z', additions: 3, deletions: 4, author };
}

function page(nodes: unknown[], endCursor: string | null, issueCount = nodes.length) {
  return { data: { search: { issueCount, pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes } } };
}

function serve(pages: Record<string, unknown>): void {
  process.env.FAKE_GH_PAGES = JSON.stringify(pages);
}

test('followsTheCursorUntilThereIsNoNextPage', async () => {
  serve({ '': page([node(1), node(2)], 'c1', 3), c1: page([node(3)], null, 3) });

  const result = await new GitHubPullRequestSource().mergedPullRequests(repository, range);

  expect(result.map((pr) => pr.number)).toEqual([1, 2, 3]);
});

test('searchesMergedPullRequestsOfTheRepositoryWithinTheRange', async () => {
  serve({ '': page([], null) });

  await new GitHubPullRequestSource().mergedPullRequests(repository, range);

  expect(readFileSync(join(workDir, 'log'), 'utf8')).toBe(
    'repo:acme/app is:pr is:merged merged:2026-01-01..2026-03-31|\n',
  );
});

test('mapsGitHubFieldsToAnActivityRecord', async () => {
  serve({ '': page([node(7)], null) });

  const result = await new GitHubPullRequestSource().mergedPullRequests(repository, range);

  expect(result).toEqual([
    {
      number: 7,
      author: { login: 'ann', isBot: false },
      createdAt: '2026-01-01T00:00:00Z',
      mergedAt: '2026-01-02T00:00:00Z',
      additions: 3,
      deletions: 4,
    },
  ]);
});

test('flagsBotAuthors', async () => {
  serve({ '': page([node(1, { login: 'dependabot', __typename: 'Bot' })], null) });

  const result = await new GitHubPullRequestSource().mergedPullRequests(repository, range);

  expect(result[0]?.author).toEqual({ login: 'dependabot', isBot: true });
});

test('mapsDeletedAccountsToNullAuthor', async () => {
  serve({ '': page([node(1, null)], null) });

  const result = await new GitHubPullRequestSource().mergedPullRequests(repository, range);

  expect(result[0]?.author).toBeNull();
});

test('moreResultsThanGitHubSearchReturnsIsADataError', async () => {
  serve({ '': page([node(1)], 'c1', 1500) });

  const result = new GitHubPullRequestSource().mergedPullRequests(repository, range);

  await expect(result).rejects.toThrow(DataError);
});

test('graphqlErrorsAreADataError', async () => {
  serve({ '': { errors: [{ message: 'Could not resolve to a Repository' }] } });

  const result = new GitHubPullRequestSource().mergedPullRequests(repository, range);

  await expect(result).rejects.toThrow('GitHub returned errors: Could not resolve to a Repository');
});

test('ghFailureIsADataErrorCarryingItsMessage', async () => {
  process.env.FAKE_GH_FAIL = 'To get started with GitHub CLI, please run: gh auth login';

  const result = new GitHubPullRequestSource().mergedPullRequests(repository, range);

  await expect(result).rejects.toThrow('gh failed: To get started with GitHub CLI, please run: gh auth login');
});

test('missingGhIsADataError', async () => {
  process.env.PATH = join(workDir, 'nowhere');

  const result = new GitHubPullRequestSource().mergedPullRequests(repository, range);

  await expect(result).rejects.toThrow('The gh CLI was not found');
});
