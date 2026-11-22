import type { Page } from '@playwright/test';
import type { FetchedPullRequest } from '../packages/core/src/index.js';
import { expect } from './fixtures.js';

export const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EARLIER_RANGE_AGO_MS = 400 * DAY_MS;

function pullRequest(number: number, mergedAgoMs: number, lines: number, commentCount = 0): FetchedPullRequest {
  const mergedAt = new Date(Date.now() - mergedAgoMs);
  return {
    number,
    author: { login: 'ann', isBot: false },
    createdAt: new Date(mergedAt.getTime() - HOUR_MS).toISOString(),
    mergedAt: mergedAt.toISOString(),
    additions: lines,
    deletions: 0,
    draftEvents: [],
    comments: Array.from({ length: commentCount }, () => ({ actor: { login: 'bob', isBot: false }, at: mergedAt.toISOString() })),
    reviewComments: [],
    reviews: [],
  };
}

export function recentPullRequests(sizes: number[]): FetchedPullRequest[] {
  return sizes.map((lines, index) => pullRequest(index + 1, HOUR_MS, lines));
}

export function earlierPullRequests(sizes: number[]): FetchedPullRequest[] {
  return sizes.map((lines, index) => pullRequest(100 + index, EARLIER_RANGE_AGO_MS, lines));
}

export function metricRow(page: Page, name: string) {
  return page.getByRole('option', { name: new RegExp(`^${name}`) });
}

export async function openDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('option').first()).toBeVisible();
}

export function commentedPullRequests(commentCounts: number[]): FetchedPullRequest[] {
  return commentCounts.map((count, index) => pullRequest(index + 1, HOUR_MS, 10, count));
}
