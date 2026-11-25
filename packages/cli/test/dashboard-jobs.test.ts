import { expect, test, vi } from 'vitest';
import { DataError, type Dashboard, type ProgressListener } from '@fluxion/core';
import { createDashboardApp, type DashboardUseCase } from '../src/http/dashboard-app.js';

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

interface PendingQuery {
  progress: ProgressListener;
  succeed(): Promise<void>;
  fail(error: Error): Promise<void>;
}

function jobsSettled(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function harness({ quickAnswerMs = 0 } = {}) {
  const queries: PendingQuery[] = [];
  const state = { refreshes: 0 };
  const useCase: DashboardUseCase = {
    count: () => Promise.reject(new Error('not used')),
    repositories: () => Promise.resolve([]),
    refresh: () => {
      state.refreshes += 1;
      return Promise.resolve();
    },
    query: (_query, onProgress = () => undefined) =>
      new Promise<Dashboard>((resolve, reject) => {
        const succeed = () => (resolve(dashboard), jobsSettled());
        const fail = (error: Error) => (reject(error), jobsSettled());
        queries.push({ progress: onProgress, succeed, fail });
      }),
  };
  const app = createDashboardApp(useCase, '/srv/web', quickAnswerMs);
  const send = async (method: string, path: string) => {
    const response = await app.request(path, { method });
    return { status: response.status, body: (await response.json()) as { jobId: string } };
  };
  return {
    queries,
    state,
    start: (query = 'period=monthly') => send('POST', `/api/pr/jobs?${query}`),
    poll: (jobId: string) => send('GET', `/api/pr/jobs/${jobId}`),
  };
}

test('aSlowQueryStartsAJobThatReportsItsProgress', async () => {
  const api = harness();
  const started = await api.start();

  api.queries[0]?.progress({ fetchedMonths: 4, totalMonths: 12 });

  expect(started.status).toBe(202);
  expect(await api.poll(started.body.jobId)).toEqual({ status: 202, body: { jobId: started.body.jobId, progress: { fetchedMonths: 4, totalMonths: 12 } } });
});

test('aFinishedJobAnswersWithTheDashboard', async () => {
  const api = harness();
  const { body } = await api.start();

  await api.queries[0]?.succeed();

  expect(await api.poll(body.jobId)).toEqual({ status: 200, body: dashboard });
});

test('aQueryThatFinishesQuicklyIsAnsweredByTheStartRequest', async () => {
  const api = harness({ quickAnswerMs: 60_000 });
  const started = api.start();
  await vi.waitFor(() => expect(api.queries).toHaveLength(1));

  api.queries[0]?.succeed();

  expect(await started).toEqual({ status: 200, body: dashboard });
});

test('aFailedJobAnswersWithTheSameErrorAsTheQuery', async () => {
  const api = harness();
  const { body } = await api.start();

  await api.queries[0]?.fail(new DataError('acme/app: boom'));

  expect(await api.poll(body.jobId)).toEqual({ status: 502, body: { error: 'acme/app: boom' } });
});

test('aDeliveredResultCanBeAskedForAgainInCaseTheResponseWasLost', async () => {
  const api = harness();
  const { body } = await api.start();
  await api.queries[0]?.succeed();
  await api.poll(body.jobId);

  expect(await api.poll(body.jobId)).toEqual({ status: 200, body: dashboard });
});

test('anUnknownJobIsNotFound', async () => {
  const api = harness();

  expect(await api.poll('nope')).toEqual({ status: 404, body: { error: 'Unknown dashboard job' } });
});

test('startingAJobWithoutPeriodIsABadRequest', async () => {
  const api = harness();

  expect(await api.start('')).toEqual({ status: 400, body: { error: 'Missing query parameter "period"' } });
});

test('startingAJobWithRefreshClearsTheServerCache', async () => {
  const api = harness();

  await api.start('period=monthly&refresh=true');

  expect(api.state.refreshes).toBe(1);
});

test('theResultThatFinishedFirstIsForgottenOnceTooManyAreKept', async () => {
  const api = harness();
  const started = await Promise.all(Array.from({ length: 21 }, () => api.start()));
  await Promise.all(api.queries.slice(1).map((query) => query.succeed()));

  await api.queries[0]?.succeed();

  expect([(await api.poll(started[0]?.body.jobId ?? '')).status, (await api.poll(started[1]?.body.jobId ?? '')).status]).toEqual([200, 404]);
});
