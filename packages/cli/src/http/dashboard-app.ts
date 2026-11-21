import { isAbsolute } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { DataError, UsageError, type Dashboard } from '@fluxion/core';
import { Hono } from 'hono';

export interface DashboardQuery {
  period: string;
  since?: string;
  until?: string;
  repos?: string[];
}

export interface DashboardUseCase {
  query(query: DashboardQuery): Promise<Dashboard>;
  refresh(): Promise<void>;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const HTTP_INTERNAL_ERROR = 500;

function splitRepos(value: string | undefined): string[] | undefined {
  const paths = (value ?? '').split(',').map((path) => path.trim()).filter((path) => path !== '');
  return paths.length === 0 ? undefined : paths;
}

function queryOf(params: URLSearchParams): DashboardQuery {
  const period = params.get('period');
  if (!period) throw new UsageError('Missing query parameter "period"');
  const query: DashboardQuery = { period };
  const since = params.get('since');
  const until = params.get('until');
  const repos = splitRepos(params.get('repos') ?? undefined);
  if (since) query.since = since;
  if (until) query.until = until;
  if (repos) query.repos = repos;
  return query;
}

export function createDashboardApp(useCase: DashboardUseCase, staticRoot: string): Hono {
  if (!isAbsolute(staticRoot)) throw new Error(`Static root must be an absolute path, got "${staticRoot}"`);
  const app = new Hono();
  app.get('/api/pr', async (context) => {
    const params = new URL(context.req.url).searchParams;
    const query = queryOf(params);
    if (params.get('refresh') === 'true') await useCase.refresh();
    return context.json(await useCase.query(query));
  });
  app.onError((error, context) => {
    if (error instanceof UsageError) return context.json({ error: error.message }, HTTP_BAD_REQUEST);
    if (error instanceof DataError) return context.json({ error: error.message }, HTTP_BAD_GATEWAY);
    console.error(error);
    return context.json({ error: 'Internal error' }, HTTP_INTERNAL_ERROR);
  });
  app.use('*', serveStatic({ root: staticRoot }));
  return app;
}
