import { test as base } from '@playwright/test';
import { startInMemoryDashboard, type InMemoryDashboard } from '../packages/cli/src/index.js';
import { InMemoryRepositoryFinder, type FetchedPullRequest, type RepositoryRef } from '../packages/core/src/index.js';

export const repository: RepositoryRef = { host: 'github', owner: 'acme', name: 'app' };

export interface DashboardData {
  setPullRequests(pullRequests: FetchedPullRequest[]): Promise<void>;
  failWith(error: Error | null): void;
  fetches(): number;
}

interface WorkerFixtures {
  server: { url: string; dashboard: InMemoryDashboard };
}

interface TestFixtures {
  data: DashboardData;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  server: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring for fixture dependencies
    async ({}, use) => {
      const dashboard = startInMemoryDashboard(new InMemoryRepositoryFinder(repository), () => new Date());
      const running = await dashboard.server;
      await use({ url: running.url, dashboard });
      await running.close();
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ server }, use) => {
    await use(server.url);
  },
  data: async ({ server }, use) => {
    const setPullRequests = async (pullRequests: FetchedPullRequest[]): Promise<void> => {
      server.dashboard.source.set(repository, pullRequests);
      await server.dashboard.refresh();
    };
    await setPullRequests([]);
    const failWith = (error: Error | null): void => server.dashboard.source.failWith(error);
    await use({ setPullRequests, failWith, fetches: () => server.dashboard.source.fetches });
    failWith(null);
  },
});

export { expect } from '@playwright/test';
