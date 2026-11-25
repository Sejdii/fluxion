import { afterEach, expect, test, vi } from 'vitest';
import { fetchDashboard } from '../src/api.js';
import type { Query } from '../src/query.js';

const query: Query = { repos: ['app'], since: '2025-01-01', until: '2026-11-22', period: 'monthly', compare: 'always' };

function respond(status: number, body: string) {
  vi.stubGlobal('fetch', async () => new Response(body, { status }));
}

afterEach(() => vi.unstubAllGlobals());

test.each([502, 504])('gatewayTimeout%iSuggestsAShorterTimeRange', async (status) => {
  respond(status, '<html>Bad gateway</html>');

  await expect(fetchDashboard(query, false)).rejects.toThrow(/large.*shorter time range/i);
});

test('otherNonJsonFailuresReportTheStatus', async () => {
  respond(500, 'oops');

  await expect(fetchDashboard(query, false)).rejects.toThrow('Request failed with HTTP 500');
});

test('jsonErrorBodiesKeepTheirMessage', async () => {
  respond(400, JSON.stringify({ error: 'bad range' }));

  await expect(fetchDashboard(query, false)).rejects.toThrow('bad range');
});

test('jsonFailuresWithoutAnErrorFieldStillFail', async () => {
  respond(504, JSON.stringify({ message: 'timeout' }));

  await expect(fetchDashboard(query, false)).rejects.toThrow(/shorter time range/);
});
