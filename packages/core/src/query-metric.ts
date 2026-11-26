import type { RepositoryMonthListener } from './dashboard-progress.js';
import { isLowSample } from './low-sample.js';
import { DataError, UsageError } from './errors.js';
import { displayName, type PullRequestActivity, type PullRequestSource, type DateRange, type RepositoryFinder, type RepositoryRef } from './pull-request-source.js';
import { bucketsOf, type PeriodBucket } from './periods.js';
import { PERIODS, resolveRange } from './range.js';
import type { WorkSchedule } from './work-schedule.js';
import { findMetric, listMetricsOf, type MetricDefinition } from './registry.js';
import { findOnOneHost } from './hosts.js';

export interface MetricPorts {
  pullRequests: PullRequestSource;
  repositories: RepositoryFinder;
}

export interface MetricRequest {
  family: string;
  metric: string;
  statistic: string;
  period: string;
  since?: string | undefined;
  until?: string | undefined;
  workSchedule?: WorkSchedule | undefined;
}

export interface MetricRow {
  period: string;
  n: number;
  value: number | null;
  lowSample?: true;
  inProgress?: true;
}

export interface MetricResult {
  range: DateRange;
  unit?: string;
  workSchedule?: WorkSchedule;
  rows: MetricRow[];
}

function definitionFor(request: MetricRequest): MetricDefinition {
  const definition = findMetric(request.family, request.metric);
  if (!definition) {
    const available = listMetricsOf(request.family)
      .map((metric) => metric.id)
      .join(', ');
    throw new UsageError(`Unknown metric "${request.metric}" for family "${request.family}". Available: ${available}`);
  }
  if (!definition.statistics.includes(request.statistic)) {
    throw new UsageError(
      `Metric "${definition.id}" does not support statistic "${request.statistic}". Allowed: ${definition.statistics.join(', ')}`,
    );
  }
  return definition;
}

export function checkPeriod(period: string): void {
  if (!(PERIODS as readonly string[]).includes(period)) {
    throw new UsageError(`Unsupported period "${period}". Allowed: ${PERIODS.join(', ')}`);
  }
}

function rowsOf(definition: MetricDefinition, statistic: string, buckets: PeriodBucket[], schedule: WorkSchedule | undefined): MetricRow[] {
  return buckets.map((bucket) => {
    const n = bucket.pullRequests.length;
    const row: MetricRow = { period: bucket.label, n, value: definition.calculate(bucket.pullRequests, statistic, schedule) };
    if (definition.perPullRequest && isLowSample(n)) row.lowSample = true;
    if (bucket.inProgress) row.inProgress = true;
    return row;
  });
}

async function fetchNamed(source: PullRequestSource, repository: RepositoryRef, range: DateRange, onMonthFetched?: RepositoryMonthListener): Promise<PullRequestActivity[]> {
  try {
    return await source.mergedPullRequests(repository, range, (month) => onMonthFetched?.(repository, month));
  } catch (error) {
    if (error instanceof DataError) throw new DataError(`${displayName(repository)}: ${error.message}`, { cause: error });
    throw error;
  }
}

export async function pooledPullRequests(source: PullRequestSource, repositories: RepositoryRef[], range: DateRange, onMonthFetched?: RepositoryMonthListener): Promise<PullRequestActivity[]> {
  const perRepository = await Promise.all(repositories.map((repository) => fetchNamed(source, repository, range, onMonthFetched)));
  return perRepository.flat();
}

export async function queryMetric(ports: MetricPorts, request: MetricRequest, now: Date): Promise<MetricResult> {
  const definition = definitionFor(request);
  checkPeriod(request.period);
  const range = resolveRange(request.period, request.since, request.until, now);
  const repositories = await findOnOneHost(ports.repositories);
  const pullRequests = await pooledPullRequests(ports.pullRequests, repositories, range);
  const rows = rowsOf(definition, request.statistic, bucketsOf(request.period, range, pullRequests, now), request.workSchedule);
  return {
    range,
    ...(definition.unit ? { unit: definition.unit } : {}),
    ...(request.workSchedule ? { workSchedule: request.workSchedule } : {}),
    rows,
  };
}
