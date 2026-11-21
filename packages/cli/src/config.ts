import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GithubCliExecutor, GitHubPullRequestSource, findRepositories } from '@fluxion/adapters';
import {
  CachingPullRequestSource,
  InMemoryCache,
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  explainPullRequest,
  queryDashboard,
  queryMetric,
  type MetricPorts,
  type PullRequestSource,
  UsageError,
  type RepositoryFinder,
} from '@fluxion/core';
import { createDashboardApp, type DashboardUseCase } from './http/dashboard-app.js';
import { openBrowser, startServer, type RunningServer } from './http/serve.js';
import type { Runners } from './program.js';

const WEB_ROOT = fileURLToPath(new URL('../../web/dist', import.meta.url));
const FREE_PORT = 0;

function cachingSource(source: PullRequestSource): CachingPullRequestSource {
  return new CachingPullRequestSource(source, new InMemoryCache());
}

function dashboardUseCase(pullRequests: CachingPullRequestSource, repositories: (repos: string[] | undefined) => RepositoryFinder, now: () => Date, startingRepos: string[] | undefined): DashboardUseCase {
  return {
    query: ({ repos, ...query }) => queryDashboard({ pullRequests, repositories: repositories(repos ?? startingRepos) }, { family: 'pr', ...query }, now()),
    refresh: () => pullRequests.clear(),
  };
}

export interface InMemoryDashboard {
  source: InMemoryPullRequestSource;
  server: Promise<RunningServer>;
  refresh(): Promise<void>;
}

export function startInMemoryDashboard(finder: InMemoryRepositoryFinder, now: () => Date): InMemoryDashboard {
  const source = new InMemoryPullRequestSource();
  const useCase = dashboardUseCase(cachingSource(source), () => finder, now, undefined);
  return { source, server: startServer(createDashboardApp(useCase, WEB_ROOT), FREE_PORT), refresh: () => useCase.refresh() };
}

function withinDirectory(directory: string, repos: string[] | undefined): string[] | undefined {
  repos?.forEach((path) => {
    const fromDirectory = relative(directory, resolve(directory, path));
    if (fromDirectory.startsWith('..') || isAbsolute(fromDirectory)) throw new UsageError(`Repository "${path}" is outside ${directory}`);
  });
  return repos;
}

export function createRunners(directory: string, now: () => Date): Runners {
  const pullRequests = cachingSource(new GitHubPullRequestSource(new GithubCliExecutor()));
  const finderFor = (repos: string[] | undefined): RepositoryFinder => ({ find: () => findRepositories(directory, repos) });
  const portsFor = (repos: string[] | undefined): MetricPorts => ({ pullRequests, repositories: finderFor(repos) });
  return {
    metric: ({ repos, ...request }) => queryMetric(portsFor(repos), request, now()),
    explain: ({ repos, number }) => explainPullRequest(portsFor(repos), { number }),
    serve: async ({ port, open, repos }) => {
      const app = createDashboardApp(dashboardUseCase(pullRequests, (selected) => finderFor(withinDirectory(directory, selected)), now, repos), WEB_ROOT);
      const { url } = await startServer(app, port ?? FREE_PORT);
      if (open) openBrowser(url);
      return url;
    },
  };
}
