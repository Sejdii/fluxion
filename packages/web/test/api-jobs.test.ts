import { afterEach, expect, test, vi } from 'vitest';
import { fetchDashboard } from '../src/api.js';
import type { Query } from '../src/query.js';

const query: Query = { repos: ['app'], since: '2025-01-01', until: '2026-11-22', period: 'monthly' };
const running = (fetchedMonths: number) => ({ status: 202, body: { jobId: 'job-1', progress: { fetchedMonths, totalMonths: 12 } } });

function serve(...answers: { status: number; body: unknown }[]) {
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    requests.push(`${init?.method ?? 'GET'} ${url.split('?')[0]}`);
    const answer = answers[requests.length - 1];
    return new Response(JSON.stringify(answer?.body), { status: answer?.status ?? 500 });
  });
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

test('aQuickQueryNeedsOnlyTheStartRequest', async () => {
  const requests = serve({ status: 200, body: { n: 3 } });

  const dashboard = await fetchDashboard(query, false, { pollMs: 0 });

  expect([dashboard, requests]).toEqual([{ n: 3 }, ['POST /api/pr/jobs']]);
});

test('aRunningJobIsPolledUntilItsResultAndReportsProgress', async () => {
  const requests = serve(running(1), running(4), { status: 200, body: { n: 3 } });
  const reported: number[] = [];

  const dashboard = await fetchDashboard(query, false, { pollMs: 0, onProgress: (progress) => reported.push(progress.fetchedMonths) });

  expect([dashboard, reported, requests]).toEqual([{ n: 3 }, [1, 4], ['POST /api/pr/jobs', 'GET /api/pr/jobs/job-1', 'GET /api/pr/jobs/job-1']]);
});

test('aFailedJobRejectsWithItsError', async () => {
  serve(running(1), { status: 502, body: { error: 'acme/app: boom' } });

  await expect(fetchDashboard(query, false, { pollMs: 0 })).rejects.toThrow('acme/app: boom');
});

test('anAbortedLoadStopsPolling', async () => {
  const requests = serve(running(1), running(2));
  const controller = new AbortController();

  const loading = fetchDashboard(query, false, { pollMs: 0, signal: controller.signal, onProgress: () => controller.abort() });

  await expect(loading).rejects.toThrow(/abort/i);
  expect(requests).toEqual(['POST /api/pr/jobs']);
});
