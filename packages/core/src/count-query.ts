import { DataError } from './errors.js';
import { displayName, type DateRange, type PullRequestSource, type RepositoryRef } from './pull-request-source.js';
import type { MetricPorts } from './query-metric.js';
import { resolveRange } from './range.js';
import { findOnOneHost } from './hosts.js';

export interface CountRequest {
  since?: string | undefined;
  until?: string | undefined;
}

export interface PullRequestCount {
  range: DateRange;
  count: number;
}

export async function countMergedAcross(source: PullRequestSource, repositories: RepositoryRef[], range: DateRange): Promise<number> {
  const counts = await Promise.all(
    repositories.map(async (repository) => {
      try {
        return await source.countMergedPullRequests(repository, range);
      } catch (error) {
        if (error instanceof DataError) throw new DataError(`${displayName(repository)}: ${error.message}`, { cause: error });
        throw error;
      }
    }),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function queryPullRequestCount(ports: MetricPorts, request: CountRequest, now: Date): Promise<PullRequestCount> {
  const range = resolveRange('monthly', request.since, request.until, now);
  const repositories = await findOnOneHost(ports.repositories);
  return { range, count: await countMergedAcross(ports.pullRequests, repositories, range) };
}
