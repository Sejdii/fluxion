import { isLowSample } from './low-sample.js';
import { UsageError } from './errors.js';
import type { PullRequestSource, DateRange, RepositoryFinder } from './pull-request-source.js';
import { bucketsOf, type PeriodBucket } from './periods.js';
import { PERIODS, resolveRange } from './range.js';
import { findMetric, listMetricsOf, type MetricDefinition } from './registry.js';

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

function checkPeriod(period: string): void {
  if (!(PERIODS as readonly string[]).includes(period)) {
    throw new UsageError(`Unsupported period "${period}". Allowed: ${PERIODS.join(', ')}`);
  }
}

function rowsOf(definition: MetricDefinition, statistic: string, buckets: PeriodBucket[]): MetricRow[] {
  return buckets.map((bucket) => {
    const n = bucket.pullRequests.length;
    const row: MetricRow = { period: bucket.label, n, value: definition.calculate(bucket.pullRequests, statistic) };
    if (definition.perPullRequest && isLowSample(n)) row.lowSample = true;
    if (bucket.inProgress) row.inProgress = true;
    return row;
  });
}

export async function queryMetric(ports: MetricPorts, request: MetricRequest, now: Date): Promise<MetricResult> {
  const definition = definitionFor(request);
  checkPeriod(request.period);
  const range = resolveRange(request.since, request.until, now);
  const repository = await ports.repositories.current();
  const pullRequests = await ports.pullRequests.mergedPullRequests(repository, range);
  const rows = rowsOf(definition, request.statistic, bucketsOf(request.period, range, pullRequests, now));
  return definition.unit ? { range, unit: definition.unit, rows } : { range, rows };
}
