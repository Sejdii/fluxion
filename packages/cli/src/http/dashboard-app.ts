import { isAbsolute } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { DataError, UsageError, parseWorkSchedule, type Dashboard, type ProgressListener, type PullRequestCount, type RepositoryOption, type WorkSchedule } from '@fluxion/core';
import { Hono, type Context } from 'hono';
import { DashboardJobs, settledWithin, type Job } from './dashboard-jobs.js';

export interface DashboardQuery {
  period: string;
  since?: string;
  until?: string;
  repos?: string[];
  workSchedule?: WorkSchedule | null;
}

export interface CountQuery {
  since?: string;
  until?: string;
  repos?: string[];
}

export interface DashboardUseCase {
  count(query: CountQuery): Promise<PullRequestCount>;
  query(query: DashboardQuery, onProgress?: ProgressListener): Promise<Dashboard>;
  refresh(): Promise<void>;
  repositories(): Promise<RepositoryOption[]>;
}

const QUICK_ANSWER_MS = 1000;
const HTTP_ACCEPTED = 202;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;
const HTTP_INTERNAL_ERROR = 500;

function splitRepos(value: string | undefined): string[] | undefined {
  const paths = (value ?? '').split(',').map((path) => path.trim()).filter((path) => path !== '');
  return paths.length === 0 ? undefined : paths;
}

function workScheduleOf(params: URLSearchParams): WorkSchedule | null | undefined {
  if (params.get('workSchedule') === 'off') return null;
  const [days, hours, timeZone] = ['workDays', 'workHours', 'timezone'].map((name) => params.get(name) || undefined);
  if (days === undefined && hours === undefined && timeZone === undefined) return undefined;
  return parseWorkSchedule({ days, hours, timeZone });
}

function queryOf(params: URLSearchParams): DashboardQuery {
  const period = params.get('period');
  if (!period) throw new UsageError('Missing query parameter "period"');
  const query: DashboardQuery = { period };
  const since = params.get('since');
  const until = params.get('until');
  const repos = splitRepos(params.get('repos') ?? undefined);
  const workSchedule = workScheduleOf(params);
  if (workSchedule !== undefined) query.workSchedule = workSchedule;
  if (since) query.since = since;
  if (until) query.until = until;
  if (repos) query.repos = repos;
  return query;
}

function countQueryOf(params: URLSearchParams): CountQuery {
  const query: CountQuery = {};
  const since = params.get('since');
  const until = params.get('until');
  const repos = splitRepos(params.get('repos') ?? undefined);
  if (since) query.since = since;
  if (until) query.until = until;
  if (repos) query.repos = repos;
  return query;
}

function answerJob(context: Context, job: Job): Response {
  const { outcome } = job;
  if (!outcome) return context.json({ jobId: job.id, progress: job.progress }, HTTP_ACCEPTED);
  if ('error' in outcome) throw outcome.error;
  return context.json(outcome.dashboard);
}

function addJobRoutes(app: Hono, useCase: DashboardUseCase, quickAnswerMs: number): void {
  const jobs = new DashboardJobs();
  app.post('/api/pr/jobs', async (context) => {
    const { query, refresh } = dashboardRequestOf(context);
    if (refresh) await useCase.refresh();
    const job = jobs.start((onProgress) => useCase.query(query, onProgress));
    await settledWithin(job, quickAnswerMs);
    return answerJob(context, job);
  });
  app.get('/api/pr/jobs/:id', (context) => {
    const job = jobs.find(context.req.param('id'));
    return job ? answerJob(context, job) : context.json({ error: 'Unknown dashboard job' }, HTTP_NOT_FOUND);
  });
}

function dashboardRequestOf(context: Context): { query: DashboardQuery; refresh: boolean } {
  const params = new URL(context.req.url).searchParams;
  return { query: queryOf(params), refresh: params.get('refresh') === 'true' };
}

export function createDashboardApp(useCase: DashboardUseCase, staticRoot: string, quickAnswerMs = QUICK_ANSWER_MS): Hono {
  if (!isAbsolute(staticRoot)) throw new Error(`Static root must be an absolute path, got "${staticRoot}"`);
  const app = new Hono();
  app.get('/api/pr', async (context) => {
    const { query, refresh } = dashboardRequestOf(context);
    if (refresh) await useCase.refresh();
    return context.json(await useCase.query(query));
  });
  addJobRoutes(app, useCase, quickAnswerMs);
  app.get('/api/pr/count', async (context) => context.json(await useCase.count(countQueryOf(new URL(context.req.url).searchParams))));
  app.get('/api/repositories', async (context) => context.json({ repositories: await useCase.repositories() }));
  app.onError((error, context) => {
    if (error instanceof UsageError) return context.json({ error: error.message }, HTTP_BAD_REQUEST);
    if (error instanceof DataError) return context.json({ error: error.message }, HTTP_BAD_GATEWAY);
    console.error(error);
    return context.json({ error: 'Internal error' }, HTTP_INTERNAL_ERROR);
  });
  app.use('*', serveStatic({ root: staticRoot }));
  return app;
}
