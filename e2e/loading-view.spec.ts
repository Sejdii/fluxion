import type { Page } from '@playwright/test';
import { DataError } from '../packages/core/src/index.js';
import { expect, test } from './fixtures.js';
import { metricRow, openDashboard, recentPullRequests } from './pull-requests.js';
import { DEFAULT_LARGE_LOAD_THRESHOLD } from '../packages/web/src/query.js';

const API = '**/api/pr/jobs?*';
const PROGRESS = /\d+ of \d+ months fetched/;

function period(page: Page, name: string) {
  return page.getByRole('group', { name: 'Period' }).getByRole('button', { name });
}

async function holdLoads(page: Page): Promise<() => Promise<void>> {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(API, async (route) => {
    await gate;
    await route.continue();
  });
  return async () => {
    release();
  };
}

test('refreshingClearsOldRowsAndChartsAndDisablesTheControlsUntilTheLoadEnds', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const release = await holdLoads(page);

  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /per period/ })).toHaveCount(0);
  await expect(page.getByRole('status')).toBeVisible();
  await expect(period(page, 'Month')).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'acme/app' })).toBeDisabled();
  await release();
  await expect(metricRow(page, 'PR size')).toContainText('30');
  await expect(period(page, 'Month')).toBeEnabled();
});

test('theFirstLoadShowsTheSkeletonWithoutControls', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  const release = await holdLoads(page);

  await page.goto('/');

  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Controls' })).toHaveCount(0);
  await release();
  await expect(page.getByRole('option').first()).toBeVisible();
});

test('aLoadFasterThanTheDelayNeverShowsTheSkeleton', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const release = await holdLoads(page);

  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect(page.getByTestId('loading-layer')).toHaveCSS('opacity', '0');
  await release();
  await expect(page.getByTestId('loading-layer')).toHaveCount(0);
  await expect(page.getByRole('option').first()).toBeVisible();
});

test('theStatusLineCyclesThroughTheMessages', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  const release = await holdLoads(page);

  await page.goto('/');

  await expect(page.getByRole('status')).toHaveText('Loading all six metrics…');
  await expect(page.getByRole('status')).toHaveText('Fetching 5 merged pull requests…');
  await release();
});

test('aFailedReloadShowsTheErrorWithoutOldDataAndRetryLoadsTheData', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  data.failWith(new DataError('boom'));

  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect(page.getByRole('alert')).toContainText('boom');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /per period/ })).toHaveCount(0);
  await expect(period(page, 'Month')).toBeEnabled();
  data.failWith(null);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(metricRow(page, 'PR size')).toContainText('30');
  await expect(period(page, 'Month')).toHaveAttribute('aria-pressed', 'true');
});

test('aRangeAboveTheLargeLoadThresholdStartsShorterWithANoticeOfTheCount', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests(Array.from({ length: DEFAULT_LARGE_LOAD_THRESHOLD + 1 }, () => 10)));

  await page.goto('/');

  await expect(page.getByRole('note')).toContainText(`${(DEFAULT_LARGE_LOAD_THRESHOLD + 1).toLocaleString('en-US')} merged PRs`);
  await expect(page.getByRole('note')).toContainText('last 3 months');
});

test('aRangeBelowTheLargeLoadThresholdShowsNoNotice', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(page.getByRole('note')).toHaveCount(0);
});

test('aStoredThresholdDecidesTheStartingRange', async ({ page, data }) => {
  await page.addInitScript(() => localStorage.setItem('fluxion.largeLoadThreshold', '4'));
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await page.goto('/');

  await expect(page.getByRole('note')).toContainText('last 3 months');
});

test('anInvalidThresholdCannotBeApplied', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);

  await page.getByRole('spinbutton', { name: /Large load threshold/ }).fill('0');

  await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
});

test('applyingAThresholdKeepsTheRangeOnScreenAndRemembersIt', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const since = await page.getByLabel('From').inputValue();

  await page.getByRole('spinbutton', { name: /Large load threshold/ }).fill('4');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(metricRow(page, 'PR size')).toContainText('30');
  await expect(page.getByLabel('From')).toHaveValue(since);
  await expect(page.getByRole('note')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('note')).toContainText('last 3 months');
});

test('aSlowLoadShowsItsProgressUntilTheDataArrives', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  const release = data.holdCurrentMonth();

  await page.goto('/');

  await expect(page.getByText(PROGRESS)).toBeVisible();
  release();
  await expect(metricRow(page, 'PR size')).toContainText('30');
  await expect(page.getByText(PROGRESS)).toHaveCount(0);
});

test('aSlowLoadThatFailsShowsTheErrorAndRetryLoadsTheData', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  const release = data.holdCurrentMonth();
  await page.goto('/');
  await expect(page.getByText(PROGRESS)).toBeVisible();

  data.failWith(new DataError('boom'));
  release();

  await expect(page.getByRole('alert')).toContainText('boom');
  data.failWith(null);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(metricRow(page, 'PR size')).toContainText('30');
});

test('cancellingASlowLoadEnablesTheControlsAndRetryLoadsTheData', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  const release = data.holdCurrentMonth();
  await page.goto('/');

  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('alert')).toContainText('Loading cancelled.');
  await expect(period(page, 'Month')).toBeEnabled();
  release();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(metricRow(page, 'PR size')).toContainText('30');
});
