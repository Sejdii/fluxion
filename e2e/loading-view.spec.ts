import type { Page } from '@playwright/test';
import { DataError } from '../packages/core/src/index.js';
import { expect, test } from './fixtures.js';
import { metricRow, openDashboard, recentPullRequests } from './pull-requests.js';

const API = '**/api/pr?*';

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
  await expect(page.getByRole('status')).toHaveText('Fetching pull requests…');
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
