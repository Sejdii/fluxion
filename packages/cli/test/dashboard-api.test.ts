import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { DataError, UsageError, type Dashboard } from '@fluxion/core';
import { createDashboardApp, type DashboardQuery, type DashboardUseCase } from '../src/http/dashboard-app.js';

const dashboard: Dashboard = {
  range: { since: '2026-02-01', until: '2026-03-20' },
  previousRange: { since: '2025-12-15', until: '2026-01-31' },
  n: 0,
  fetchedAt: '2026-03-20T10:00:00.000Z',
  lowSampleThreshold: 5,
  metrics: [],
};

interface Harness {
  queries: DashboardQuery[];
  refreshes: number;
  request(path: string): Promise<Response>;
}

function harness(query: DashboardUseCase['query'] = () => Promise.resolve(dashboard), staticRoot = '/srv/web'): Harness {
  const state = { queries: [] as DashboardQuery[], refreshes: 0 };
  const useCase: DashboardUseCase = {
    query: (request) => {
      state.queries.push(request);
      return query(request);
    },
    refresh: () => {
      state.refreshes += 1;
      return Promise.resolve();
    },
  };
  const app = createDashboardApp(useCase, staticRoot);
  return Object.assign(state, { request: (path: string) => Promise.resolve(app.request(path)) });
}

test('apiPrReturnsTheDashboardAsJson', async () => {
  const api = harness();

  const response = await api.request('/api/pr?period=monthly');

  expect([response.status, await response.json()]).toEqual([200, dashboard]);
});

test('apiPrMapsQueryParametersToTheUseCaseRequest', async () => {
  const api = harness();

  await api.request('/api/pr?repos=a,%20b&since=2026-01-01&until=2026-02-01&period=weekly');

  expect(api.queries).toEqual([{ period: 'weekly', since: '2026-01-01', until: '2026-02-01', repos: ['a', 'b'] }]);
});

test('apiPrOmitsParametersThatWereNotGiven', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly&repos=');

  expect(api.queries).toEqual([{ period: 'monthly' }]);
});

test('apiPrWithoutPeriodIsABadRequest', async () => {
  const api = harness();

  const response = await api.request('/api/pr');

  expect([response.status, await response.json()]).toEqual([400, { error: 'Missing query parameter "period"' }]);
});

test('apiPrUsageErrorFromTheUseCaseIsABadRequest', async () => {
  const api = harness(() => Promise.reject(new UsageError('Invalid date "x". Use YYYY-MM-DD')));

  const response = await api.request('/api/pr?period=monthly&since=x');

  expect([response.status, await response.json()]).toEqual([400, { error: 'Invalid date "x". Use YYYY-MM-DD' }]);
});

test('apiPrRateLimitFailureReturnsTheDataErrorWithTheResetTime', async () => {
  const message = 'acme/app: GitHub rate limit is too low to fetch the next page (3 remaining). It resets at 2026-03-20T11:00:00Z';
  const api = harness(() => Promise.reject(new DataError(message)));

  const response = await api.request('/api/pr?period=monthly');

  expect([response.status, await response.json()]).toEqual([502, { error: message }]);
});

test('apiPrUnexpectedFailureIsAnInternalError', async () => {
  const api = harness(() => Promise.reject(new Error('secret detail')));

  const response = await api.request('/api/pr?period=monthly');

  expect([response.status, await response.json()]).toEqual([500, { error: 'Internal error' }]);
});

test('apiPrRefreshClearsTheServerCacheBeforeQuerying', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly&refresh=true');

  expect(api.refreshes).toBe(1);
});

test('apiPrWithoutRefreshKeepsTheServerCache', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly');

  expect(api.refreshes).toBe(0);
});

test('rootServesTheStaticPageFromTheAbsoluteRoot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fluxion-static-'));
  writeFileSync(join(root, 'index.html'), '<h1>Fluxion</h1>');
  const api = harness(undefined, root);

  const response = await api.request('/');

  expect([response.status, await response.text()]).toEqual([200, '<h1>Fluxion</h1>']);
});

test('relativeStaticRootIsRejected', () => {
  expect(() => harness(undefined, 'packages/web/dist')).toThrow('Static root must be an absolute path');
});
