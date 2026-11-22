import { DataError } from '../packages/core/src/index.js';
import { expect, test } from './fixtures.js';
import { metricRow, openDashboard, recentPullRequests } from './pull-requests.js';
import type { Page } from '@playwright/test';

const RATE_LIMIT_REASON = 'GitHub rate limit is too low to fetch the next page (3 remaining). It resets at 2026-03-20T11:00:00Z';
const RATE_LIMIT_MESSAGE = `acme/app: ${RATE_LIMIT_REASON}`;
const LONG_RANGE_START = '2024-01-01';
const DAY_HINT = 'Day needs a range of 12 months or less';

function period(page: Page, name: string) {
  return page.getByRole('group', { name: 'Period' }).getByRole('button', { name });
}

test('rateLimitOnFirstLoadShowsTheMessageWithTheResetTime', async ({ page, data }) => {
  data.failWith(new DataError(RATE_LIMIT_REASON));

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText(RATE_LIMIT_MESSAGE);
});

test('rateLimitAfterRefreshKeepsTheChartsAlreadyLoaded', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  data.failWith(new DataError(RATE_LIMIT_REASON));

  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect(page.getByRole('alert')).toHaveText(RATE_LIMIT_MESSAGE);
  await expect(metricRow(page, 'PR size')).toContainText('30');
});

test('emptyRangeShowsNoChart', async ({ page, data }) => {
  await data.setPullRequests([]);

  await openDashboard(page);

  await expect(page.getByText('No merged PRs in this range')).toBeVisible();
  await expect(page.locator('.chart')).toHaveCount(0);
});

test('defaultsAreMonthlyAndTheFirstMetric', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));

  await openDashboard(page);

  await expect(period(page, 'Month')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('option', { selected: true })).toHaveText(/Review waiting time/);
});

test('changingThePeriodDoesNotFetchFromTheSourceAgain', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const fetchesAfterLoad = data.fetches();

  await period(page, 'Week').click();
  await expect(period(page, 'Week')).toHaveAttribute('aria-pressed', 'true');

  expect(data.fetches()).toBe(fetchesAfterLoad);
});

test('dayPeriodIsDisabledWithAHintOverTwelveMonths', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);

  await page.getByLabel('From').fill(LONG_RANGE_START);

  await expect(period(page, 'Day')).toBeDisabled();
  await expect(page.getByText(DAY_HINT)).toBeVisible();
});

test('applyingALongRangeFallsBackFromDayToWeek', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  await period(page, 'Day').click();
  await expect(period(page, 'Day')).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('From').fill(LONG_RANGE_START);
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(period(page, 'Week')).toHaveAttribute('aria-pressed', 'true');
});

test('rangeChangesNeedApplyBeforeFetching', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const fetchesAfterLoad = data.fetches();

  await page.getByLabel('From').fill(LONG_RANGE_START);

  await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled();
  expect(data.fetches()).toBe(fetchesAfterLoad);
});

test('refreshFetchesFreshDataFromTheSource', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const fetchesAfterLoad = data.fetches();

  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect.poll(() => data.fetches()).toBeGreaterThan(fetchesAfterLoad);
});

test('repositoryTogglesStartCheckedAndApplyNeedsAtLeastOne', async ({ page, data }) => {
  await data.setPullRequests(recentPullRequests([10, 20, 30, 40, 50]));
  await openDashboard(page);
  const toggle = page.getByRole('checkbox', { name: 'acme/app' });
  await expect(toggle).toBeChecked();

  await toggle.uncheck();

  await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
});
