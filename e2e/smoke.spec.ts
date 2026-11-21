import { expect, test } from './fixtures.js';

test('pageShowsFluxion', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Fluxion')).toBeVisible();
});
