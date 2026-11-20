import { expect, test } from '@playwright/test';

test('pageShowsFluxion', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Fluxion')).toBeVisible();
});
