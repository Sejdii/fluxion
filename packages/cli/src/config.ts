import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GithubCliExecutor, GitHubPullRequestSource, findRepositories, locateRepositories, loggedInHosts } from '@fluxion/adapters';
import {
  CachingPullRequestSource,
  InMemoryCache,
  InMemoryPullRequestSource,
  explainPullRequest,
  queryDashboard,
  queryPullRequestCount,
  queryMetric,
  type MetricPorts,
  type RepositoryOption,
  displayName,
  type PullRequestSource,
  UsageError,
  type RepositoryFinder,
  type WorkSchedule,
} from '@fluxion/core';
import { createDashboardApp, type DashboardUseCase } from './http/dashboard-app.js';
import { openBrowser, startServer, type RunningServer } from './http/serve.js';
import type { Runners } from './program.js';
import { rememberedHosts } from './remembered-hosts.js';

const WEB_ROOT = fileURLToPath(new URL('../../web/dist', import.meta.url));
const FREE_PORT = 0;

function cachingSource(source: PullRequestSource): CachingPullRequestSource {
  return new CachingPullRequestSource(source, new InMemoryCache());
}

interface RepositorySelection {
  finder(repos: string[] | undefined): RepositoryFinder;
  options(): Promise<RepositoryOption[]>;
}

function dashboardUseCase(pullRequests: CachingPullRequestSource, selection: RepositorySelection, now: () => Date, starting: { repos?: string[] | undefined; workSchedule?: WorkSchedule | undefined }): DashboardUseCase {
  return {
    repositories: selection.options,
    count: ({ repos, ...query }) => queryPullRequestCount({ pullRequests, repositories: selection.finder(repos ?? starting.repos) }, query, now()),
    query: ({ repos, workSchedule, ...query }, onProgress) => {
      const schedule = workSchedule === undefined ? starting.workSchedule : workSchedule;
      return queryDashboard({ pullRequests, repositories: selection.finder(repos ?? starting.repos) }, { family: 'pr', ...query, ...(schedule ? { workSchedule: schedule } : {}) }, now(), onProgress);
    },
    refresh: () => pullRequests.clear(),
  };
}

export interface InMemoryDashboard {
  source: InMemoryPullRequestSource;
  server: Promise<RunningServer>;
  refresh(): Promise<void>;
}

export function startInMemoryDashboard(finder: RepositoryFinder, now: () => Date): InMemoryDashboard {
  const source = new InMemoryPullRequestSource();
  const options = async (): Promise<RepositoryOption[]> => (await finder.find()).map((repository) => ({ path: repository.name, name: displayName(repository), host: repository.host }));
  const selecting = (selected: string[] | undefined): RepositoryFinder => ({
    find: async () => (await finder.find()).filter((repository) => !selected || selected.includes(repository.name)),
  });
  const useCase = dashboardUseCase(cachingSource(source), { finder: selecting, options }, now, {});
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
  const hosts = rememberedHosts(loggedInHosts);
  const finderFor = (repos: string[] | undefined): RepositoryFinder => ({ find: () => hosts.using((loadHosts) => findRepositories(directory, loadHosts, repos)) });
  const portsFor = (repos: string[] | undefined): MetricPorts => ({ pullRequests, repositories: finderFor(repos) });
  return {
    metric: ({ repos, ...request }) => queryMetric(portsFor(repos), request, now()),
    explain: ({ repos, ...request }) => explainPullRequest(portsFor(repos), request),
    serve: async ({ port, open, repos, workSchedule }) => {
      const options = async (): Promise<RepositoryOption[]> =>
        (await hosts.using((loadHosts) => locateRepositories(directory, loadHosts, repos))).map(({ path, repository }) => ({ path, name: displayName(repository), host: repository.host }));
      const finder = (selected: string[] | undefined): RepositoryFinder => finderFor(withinDirectory(directory, selected));
      const app = createDashboardApp(dashboardUseCase(pullRequests, { finder, options }, now, { repos, workSchedule }), WEB_ROOT);
      const { url } = await startServer(app, port ?? FREE_PORT);
      if (open) openBrowser(url);
      return url;
    },
  };
}
