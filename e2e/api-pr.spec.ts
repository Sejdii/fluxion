import { expect, test } from './fixtures.js';

function mergedPullRequest(number: number, mergedAt: string) {
  return {
    number,
    author: { login: 'ann', isBot: false },
    createdAt: '2025-01-01T00:00:00Z',
    mergedAt,
    additions: 4,
    deletions: 6,
    draftEvents: [],
    comments: [],
    reviewComments: [],
    reviews: [],
  };
}

test('apiPrReturnsTheDataSetForThisTest', async ({ request, data }) => {
  await data.setPullRequests([mergedPullRequest(1, '2026-03-01T10:00:00Z'), mergedPullRequest(2, '2026-03-02T10:00:00Z')]);

  const response = await request.get('/api/pr?period=monthly&since=2026-03-01&until=2026-03-31&repos=ignored');
  const body = await response.json();

  expect(body.metrics[3].rows[0]).toMatchObject({ period: '2026-03', n: 2, values: { median: 10 } });
});

test('apiPrStartsEmptyForTheNextTest', async ({ request, data }) => {
  await data.setPullRequests([]);

  const response = await request.get('/api/pr?period=monthly&since=2026-03-01&until=2026-03-31');

  expect((await response.json()).n).toBe(0);
});

test('apiPrWithoutPeriodIsABadRequest', async ({ request }) => {
  const response = await request.get('/api/pr');

  expect(response.status()).toBe(400);
});

