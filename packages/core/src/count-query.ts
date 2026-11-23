import { DataError } from './errors.js';
import { displayName, type DateRange } from './pull-request-source.js';
import type { MetricPorts } from './query-metric.js';
import { resolveRange } from './range.js';

export interface CountRequest {
  since?: string | undefined;
  until?: string | undefined;
}

export interface PullRequestCount {
  range: DateRange;
  count: number;
}

export async function queryPullRequestCount(ports: MetricPorts, request: CountRequest, now: Date): Promise<PullRequestCount> {
  const range = resolveRange('monthly', request.since, request.until, now);
  const repositories = await ports.repositories.find();
  const counts = await Promise.all(
    repositories.map(async (repository) => {
      try {
        return await ports.pullRequests.countMergedPullRequests(repository, range);
      } catch (error) {
        if (error instanceof DataError) throw new DataError(`${displayName(repository)}: ${error.message}`, { cause: error });
        throw error;
      }
    }),
  );
  return { range, count: counts.reduce((sum, count) => sum + count, 0) };
}
