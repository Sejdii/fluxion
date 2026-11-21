import { isLowSample, LOW_SAMPLE_THRESHOLD } from './low-sample.js';
import { UsageError } from './errors.js';
import { bucketsOf } from './periods.js';
import type { DateRange, PullRequestActivity } from './pull-request-source.js';
import { checkPeriod, pooledPullRequests, type MetricPorts } from './query-metric.js';
import { previousRangeOf, resolveRange } from './range.js';
import { definitionsOf, type MetricDefinition } from './registry.js';

export interface DashboardRequest {
  family: string;
  period: string;
  since?: string | undefined;
  until?: string | undefined;
}

export interface DashboardSummary {
  n: number;
  values: Record<string, number | null>;
  lowSample?: true;
}

export interface DashboardRow extends DashboardSummary {
  period: string;
  inProgress?: true;
}

export interface DashboardMetric {
  id: string;
  unit?: string;
  rows: DashboardRow[];
  tiles: { current: DashboardSummary; previous: DashboardSummary };
}

export interface Dashboard {
  range: DateRange;
  previousRange: DateRange;
  n: number;
  fetchedAt: string;
  lowSampleThreshold: number;
  metrics: DashboardMetric[];
}

function summaryOf(definition: MetricDefinition, pullRequests: PullRequestActivity[]): DashboardSummary {
  const n = pullRequests.length;
  const values = Object.fromEntries(definition.statistics.map((statistic) => [statistic, definition.calculate(pullRequests, statistic)]));
  return definition.perPullRequest && isLowSample(n) ? { n, values, lowSample: true } : { n, values };
}

interface Pools {
  period: string;
  range: DateRange;
  current: PullRequestActivity[];
  previous: PullRequestActivity[];
}

function metricOf(definition: MetricDefinition, pools: Pools, now: Date): DashboardMetric {
  const rows = bucketsOf(pools.period, pools.range, pools.current, now).map((bucket) => {
    const row: DashboardRow = { period: bucket.label, ...summaryOf(definition, bucket.pullRequests) };
    return bucket.inProgress ? { ...row, inProgress: true as const } : row;
  });
  const tiles = { current: summaryOf(definition, pools.current), previous: summaryOf(definition, pools.previous) };
  return definition.unit ? { id: definition.id, unit: definition.unit, rows, tiles } : { id: definition.id, rows, tiles };
}

export async function queryDashboard(ports: MetricPorts, request: DashboardRequest, now: Date): Promise<Dashboard> {
  const definitions = definitionsOf(request.family);
  if (definitions.length === 0) throw new UsageError(`Unknown family "${request.family}"`);
  checkPeriod(request.period);
  const range = resolveRange(request.period, request.since, request.until, now);
  const previousRange = previousRangeOf(range);
  const repositories = await ports.repositories.find();
  const current = await pooledPullRequests(ports.pullRequests, repositories, range);
  const previous = await pooledPullRequests(ports.pullRequests, repositories, previousRange);
  const metrics = definitions.map((definition) => metricOf(definition, { period: request.period, range, current, previous }, now));
  return { range, previousRange, n: current.length, fetchedAt: now.toISOString(), lowSampleThreshold: LOW_SAMPLE_THRESHOLD, metrics };
}
