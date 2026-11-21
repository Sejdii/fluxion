import type { Page } from '@playwright/test';
import type { FetchedPullRequest } from '../packages/core/src/index.js';
import { expect, test } from './fixtures.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EARLIER_RANGE_AGO_MS = 400 * DAY_MS;
const GOODHARTS_LAW_URL = 'https://lawsofsoftwareengineering.com/laws/goodharts-law/';
const IN_PROGRESS_PERIOD = /^\d{4}-\d{2} \(in progress\)$/;

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

function metricRow(page: Page, name: string) {
  return page.getByRole('option', { name: new RegExp(`^${name}`) });
}

function tile(page: Page, label: string) {
  return page.getByRole('group', { name: label });
}

async function openDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('railListsAllSixMetrics', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(page.getByRole('option')).toHaveText([/Review waiting time/, /Total review time/, /PRs merged/, /PR size/, /Comments/, /Reviewers/]);
});

test('firstMetricIsSelectedByDefault', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(page.getByRole('option', { selected: true })).toHaveText(/Review waiting time/);
});

test('railRowShowsTheHeadlineValue', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(metricRow(page, 'PR size')).toContainText('30');
});

test('selectingAMetricShowsItsDetailPane', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);

  await metricRow(page, 'PR size').click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PR size');
  await expect(page.getByRole('option', { selected: true })).toHaveText(/PR size/);
});

async function selectPrSizeOfFivePullRequests(page: Page, data: { setPullRequests(pullRequests: FetchedPullRequest[]): Promise<void> }): Promise<void> {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await metricRow(page, 'PR size').click();
}

test('medianTileShowsTheMedian', async ({ page, data }) => {
  await selectPrSizeOfFivePullRequests(page, data);

  await expect(tile(page, 'Median')).toContainText('30');
});

test('p90TileShowsTheNinetiethPercentile', async ({ page, data }) => {
  await selectPrSizeOfFivePullRequests(page, data);

  await expect(tile(page, 'p90')).toContainText('50');
});

test('sampleSizeTileShowsTheNumberOfMergedPrs', async ({ page, data }) => {
  await selectPrSizeOfFivePullRequests(page, data);

  await expect(tile(page, 'Merged PRs (n)')).toContainText('5');
});

test('tilesShowTheTotalForPrsMerged', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);

  await metricRow(page, 'PRs merged').click();

  await expect(tile(page, 'Total')).toContainText('5');
});

test('viewDataShowsExactValuesPerPeriod', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await metricRow(page, 'PR size').click();

  await page.getByRole('button', { name: 'View data' }).click();

  const lastRow = page.getByRole('table').getByRole('row').last();
  await expect(lastRow.getByRole('cell')).toHaveText([IN_PROGRESS_PERIOD, '5', '30', '50']);
});

test('viewDataShowsCountsForPrsMerged', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30]));
  await openDashboard(page);
  await metricRow(page, 'PRs merged').click();

  await page.getByRole('button', { name: 'View data' }).click();

  const lastRow = page.getByRole('table').getByRole('row').last();
  await expect(lastRow.getByRole('cell')).toHaveText([IN_PROGRESS_PERIOD, '3']);
});

test('viewDataTogglesBackToTheDetailPane', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await page.getByRole('button', { name: 'View data' }).click();

  await page.getByRole('button', { name: 'Hide data' }).click();

  await expect(page.getByRole('table')).toBeHidden();
});

test('changeIsSignedAndNeutralAgainstThePreviousRange', async ({ page, data }) => {
  await data.setPullRequests([...recentPullRequests([30, 30, 30, 30, 30]), ...earlierPullRequests([20, 20, 20, 20, 20])]);
  await openDashboard(page);

  await metricRow(page, 'PR size').click();

  await expect(tile(page, 'Median')).toContainText('+50%');
});

test('changeIsHiddenWhenTheCurrentRangeIsALowSample', async ({ page, data }) => {
  await data.setPullRequests([...recentPullRequests([30, 30, 30]), ...earlierPullRequests([20, 20, 20, 20, 20])]);
  await openDashboard(page);

  await metricRow(page, 'PR size').click();

  await expect(tile(page, 'Median')).not.toContainText('%');
});

test('p90IsHiddenAndTaggedForALowSample', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30]));
  await openDashboard(page);

  await metricRow(page, 'PR size').click();

  await expect(tile(page, 'p90')).toContainText('low sample');
});

test('emptyRangeSaysThereAreNoMergedPrs', async ({ page, data }) => {
  await data.setPullRequests([]);

  await openDashboard(page);

  await expect(page.getByText('No merged PRs in this range')).toBeVisible();
});

test('goodhartsLawLinkAppearsExactlyOnce', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(page.getByRole('link')).toHaveCount(1);
});

test('goodhartsLawLinkPointsToTheLawsOfSoftwareEngineering', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(page.getByRole('link', { name: 'Goodhart’s law' })).toHaveAttribute('href', GOODHARTS_LAW_URL);
});
