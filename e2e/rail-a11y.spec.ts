import type { Page } from '@playwright/test';
import type { FetchedPullRequest } from '../packages/core/src/index.js';
import { expect, test } from './fixtures.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EARLIER_RANGE_AGO_MS = 400 * DAY_MS;

function pullRequest(number: number, mergedAgoMs: number, lines: number): FetchedPullRequest {
  const mergedAt = new Date(Date.now() - mergedAgoMs);
  return {
    number,
    author: { login: 'ann', isBot: false },
    createdAt: new Date(mergedAt.getTime() - HOUR_MS).toISOString(),
    mergedAt: mergedAt.toISOString(),
    additions: lines,
    deletions: 0,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
  };
}

function recentPullRequests(sizes: number[]): FetchedPullRequest[] {
  return sizes.map((lines, index) => pullRequest(index + 1, HOUR_MS, lines));
}

function earlierPullRequests(sizes: number[]): FetchedPullRequest[] {
  return sizes.map((lines, index) => pullRequest(100 + index, EARLIER_RANGE_AGO_MS, lines));
}

async function openDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('arrowDownMovesSelectionToTheNextMetric', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await page.getByRole('option', { selected: true }).focus();

  await page.keyboard.press('ArrowDown');

  await expect(page.getByRole('option', { selected: true })).toHaveText(/Total review time/);
  await expect(page.getByRole('option', { selected: true })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Total review time');
});

test('arrowUpMovesSelectionToThePreviousMetric', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await page.getByRole('option', { name: /^PR size/ }).click();
  await page.getByRole('option', { selected: true }).focus();

  await page.keyboard.press('ArrowUp');

  await expect(page.getByRole('option', { selected: true })).toHaveText(/PRs merged/);
});

test('arrowKeysDoNotWrapAtTheEnds', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await page.getByRole('option', { selected: true }).focus();

  await page.keyboard.press('ArrowUp');

  await expect(page.getByRole('option', { selected: true })).toHaveText(/Review waiting time/);
});

test('endJumpsToTheLastMetric', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await page.getByRole('option', { selected: true }).focus();

  await page.keyboard.press('End');

  await expect(page.getByRole('option', { selected: true })).toHaveText(/Reviewers/);
});

test('homeJumpsToTheFirstMetric', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await page.getByRole('option', { name: /^PR size/ }).click();
  await page.getByRole('option', { selected: true }).focus();

  await page.keyboard.press('Home');

  await expect(page.getByRole('option', { selected: true })).toHaveText(/Review waiting time/);
});

test('railIsASingleTabStop', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('[role="option"][tabindex="-1"]')).toHaveCount(5);
});

test('tabOrderIsHeaderLinkThenControlsThenRailThenDetailPane', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Goodhart’s law' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'acme/app' })).toBeFocused();
  await page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'Year' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('option', { selected: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeFocused();
  for (const tile of ['Median', 'p90', 'Merged PRs (n)']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('group', { name: tile }).getByRole('button')).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'View data' })).toBeFocused();
});

test('rowAccessibleNameCarriesMetricValueAndChange', async ({ page, data }) => {
  await data.setPullRequests([...recentPullRequests([30, 30, 30, 30, 30]), ...earlierPullRequests([20, 20, 20, 20, 20])]);

  await openDashboard(page);

  await expect(page.getByRole('option', { name: 'PR size, 30, up 50% vs previous range' })).toBeVisible();
});

test('rowAccessibleNameSaysLowSampleWhenItApplies', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30]));

  await openDashboard(page);

  await expect(page.getByRole('option', { name: 'PR size, 20, low sample' })).toBeVisible();
});
