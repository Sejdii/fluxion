import { UsageError } from './errors.js';
import type { PullRequestActivity, PullRequestSource, DateRange, RepositoryFinder } from './pull-request-source.js';
import { PERIODS, monthLabelsOf, resolveRange } from './range.js';
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
  /** Number of merged pull requests in the period. */
  n: number;
  value: number | null;
}

export interface MetricResult {
  range: DateRange;
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

function monthRows(definition: MetricDefinition, range: DateRange, pullRequests: PullRequestActivity[]): MetricRow[] {
  return monthLabelsOf(range).map((period) => {
    const inPeriod = pullRequests.filter((pr) => pr.mergedAt.startsWith(period));
    return { period, n: inPeriod.length, value: definition.calculate(inPeriod) };
  });
}

export async function queryMetric(ports: MetricPorts, request: MetricRequest, now: Date): Promise<MetricResult> {
  const definition = definitionFor(request);
  checkPeriod(request.period);
  const range = resolveRange(request.since, request.until, now);
  const repository = await ports.repositories.current();
  const pullRequests = await ports.pullRequests.mergedPullRequests(repository, range);
  return { range, rows: monthRows(definition, range, pullRequests) };
}
