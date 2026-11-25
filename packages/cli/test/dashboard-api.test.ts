import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { DataError, UsageError, type Dashboard, type RepositoryOption } from '@fluxion/core';
import { createDashboardApp, type CountQuery, type DashboardQuery, type DashboardUseCase } from '../src/http/dashboard-app.js';

const dashboard: Dashboard = {
  range: { since: '2026-02-01', until: '2026-03-20' },
  previousRange: { since: '2025-12-15', until: '2026-01-31' },
  n: 0,
  fetchedAt: '2026-03-20T10:00:00.000Z',
  lowSampleThreshold: 5,
  dayPeriodMaxMonths: 12,
  repositories: [],
  metrics: [],
};

const options: RepositoryOption[] = [{ path: 'app', name: 'acme/app' }];

interface Harness {
  queries: DashboardQuery[];
  counts: CountQuery[];
  refreshes: number;
  request(path: string): Promise<Response>;
}

function harness(query: DashboardUseCase['query'] = () => Promise.resolve(dashboard), staticRoot = '/srv/web'): Harness {
  const state = { queries: [] as DashboardQuery[], counts: [] as CountQuery[], refreshes: 0 };
  const useCase: DashboardUseCase = {
    count: (request) => {
      state.counts.push(request);
      return Promise.resolve({ range: { since: '2026-01-01', until: '2026-02-01' }, count: 7 });
    },
    query: (request) => {
      state.queries.push(request);
      return query(request);
    },
    refresh: () => {
      state.refreshes += 1;
      return Promise.resolve();
    },
    repositories: () => Promise.resolve(options),
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

test('apiPrParsesTheWorkScheduleParametersWithDefaults', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly&workDays=mon,wed&workHours=07:00-18:00&timezone=UTC');
  await api.request('/api/pr?period=monthly&timezone=Europe/Warsaw');

  expect(api.queries[0]?.workSchedule).toEqual({ days: ['mon', 'wed'], start: '07:00', end: '18:00', timeZone: 'UTC' });
  expect(api.queries[1]?.workSchedule).toEqual({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00', timeZone: 'Europe/Warsaw' });
});

test('apiPrWorkScheduleOffAsksForNoSchedule', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly&workSchedule=off');

  expect(api.queries[0]?.workSchedule).toBeNull();
});

test('apiPrInvalidWorkScheduleIsABadRequestWithoutQuerying', async () => {
  const api = harness();

  const response = await api.request('/api/pr?period=monthly&workHours=18:00-07:00');

  expect([response.status, await response.json(), api.queries]).toEqual([400, { error: 'Work hours "18:00-07:00" must start before they end' }, []]);
});

test.each([
  ['workDays=funday', 'Unknown weekday "funday". Use mon, tue, wed, thu, fri, sat, sun'],
  ['timezone=Mars/Base', 'Unknown time zone "Mars/Base". Use an IANA name such as Europe/Warsaw'],
])('apiPrInvalidWorkScheduleParameter%#IsABadRequest', async (parameter, message) => {
  const api = harness();

  const response = await api.request(`/api/pr?period=monthly&${parameter}`);

  expect([response.status, await response.json()]).toEqual([400, { error: message }]);
});

test('apiPrWithoutWorkScheduleParametersLeavesItOut', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly');

  expect('workSchedule' in (api.queries[0] ?? {})).toBe(false);
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

test('apiRepositoriesListsTheStartingSelection', async () => {
  const api = harness();

  const response = await api.request('/api/repositories');

  expect([response.status, await response.json()]).toEqual([200, { repositories: options }]);
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

test('apiPrCountReturnsTheCountAndMapsQueryParameters', async () => {
  const api = harness();

  const response = await api.request('/api/pr/count?repos=a,b&since=2026-01-01&until=2026-02-01');

  expect([response.status, await response.json(), api.counts]).toEqual([
    200,
    { range: { since: '2026-01-01', until: '2026-02-01' }, count: 7 },
    [{ since: '2026-01-01', until: '2026-02-01', repos: ['a', 'b'] }],
  ]);
});

test('apiPrPassesTheComparisonModeToTheUseCase', async () => {
  const api = harness();

  await api.request('/api/pr?period=monthly&compare=never');

  expect(api.queries).toEqual([{ period: 'monthly', compare: 'never' }]);
});

test('apiPrUnknownComparisonModeIsABadRequestWithoutQuerying', async () => {
  const api = harness();

  const response = await api.request('/api/pr?period=monthly&compare=sometimes');

  expect([response.status, await response.json(), api.queries]).toEqual([400, { error: 'Unknown comparison mode "sometimes". Use always, never' }, []]);
});

test('apiPrEmptyComparisonModeIsABadRequest', async () => {
  const api = harness();

  const response = await api.request('/api/pr?period=monthly&compare=');

  expect(response.status).toBe(400);
});
