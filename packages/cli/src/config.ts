import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GithubCliExecutor, GitHubPullRequestSource, findRepositories, locateRepositories } from '@fluxion/adapters';
import {
  CachingPullRequestSource,
  InMemoryCache,
  InMemoryPullRequestSource,
  explainPullRequest,
  queryDashboard,
  queryMetric,
  type MetricPorts,
  type RepositoryOption,
  displayName,
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

interface RepositorySelection {
  finder(repos: string[] | undefined): RepositoryFinder;
  options(): Promise<RepositoryOption[]>;
}

function dashboardUseCase(pullRequests: CachingPullRequestSource, selection: RepositorySelection, now: () => Date, startingRepos: string[] | undefined): DashboardUseCase {
  return {
    repositories: selection.options,
    query: ({ repos, ...query }) => queryDashboard({ pullRequests, repositories: selection.finder(repos ?? startingRepos) }, { family: 'pr', ...query }, now()),
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
  const options = async (): Promise<RepositoryOption[]> => (await finder.find()).map((repository) => ({ path: repository.name, name: displayName(repository) }));
  const selecting = (selected: string[] | undefined): RepositoryFinder => ({
    find: async () => (await finder.find()).filter((repository) => !selected || selected.includes(repository.name)),
  });
  const useCase = dashboardUseCase(cachingSource(source), { finder: selecting, options }, now, undefined);
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
      const options = async (): Promise<RepositoryOption[]> =>
        (await locateRepositories(directory, repos)).map(({ path, repository }) => ({ path, name: displayName(repository) }));
      const finder = (selected: string[] | undefined): RepositoryFinder => finderFor(withinDirectory(directory, selected));
      const app = createDashboardApp(dashboardUseCase(pullRequests, { finder, options }, now, repos), WEB_ROOT);
      const { url } = await startServer(app, port ?? FREE_PORT);
      if (open) openBrowser(url);
      return url;
    },
  };
}
