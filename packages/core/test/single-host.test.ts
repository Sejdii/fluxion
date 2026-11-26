import { expect, test } from 'vitest';
import {
  InMemoryPullRequestSource,
  InMemoryRepositoryFinder,
  UsageError,
  queryDashboard,
  queryMetric,
  queryPullRequestCount,
  type MetricPorts,
  type RepositoryRef,
} from '../src/index.js';

const app: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'app' };
const api: RepositoryRef = { host: 'github.com', owner: 'acme', name: 'api' };
const internal: RepositoryRef = { host: 'github.corp.example', owner: 'corp', name: 'internal' };
const now = new Date('2026-03-20T10:00:00Z');
const MIXED_MESSAGE =
  'Repositories must all be on the same host. github.com: acme/app, acme/api; github.corp.example: corp/internal. Choose one host with --repos';

function portsOf(...repositories: RepositoryRef[]): MetricPorts {
  return { pullRequests: new InMemoryPullRequestSource(), repositories: new InMemoryRepositoryFinder(...repositories) };
}

test('metricOverSeveralHostsIsAUsageError', async () => {
  const result = queryMetric(portsOf(app, internal, api), { family: 'pr', metric: 'prsMerged', statistic: 'total', period: 'monthly' }, now);

  await expect(result).rejects.toThrow(new UsageError(MIXED_MESSAGE));
});

test('dashboardOverSeveralHostsIsAUsageError', async () => {
  const result = queryDashboard(portsOf(app, internal, api), { family: 'pr', period: 'monthly' }, now);

  await expect(result).rejects.toThrow(new UsageError(MIXED_MESSAGE));
});

test('countOverSeveralHostsIsAUsageError', async () => {
  const result = queryPullRequestCount(portsOf(app, internal, api), {}, now);

  await expect(result).rejects.toThrow(new UsageError(MIXED_MESSAGE));
});

test('repositoriesOnOneEnterpriseHostArePooled', async () => {
  const result = await queryPullRequestCount(portsOf(internal, { ...internal, name: 'other' }), {}, now);

  expect(result.count).toBe(0);
});
