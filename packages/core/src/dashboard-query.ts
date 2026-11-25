import { trackMonths, type ProgressListener } from './dashboard-progress.js';
import { isLowSample, LOW_SAMPLE_THRESHOLD } from './low-sample.js';
import { UsageError } from './errors.js';
import { bucketsOf } from './periods.js';
import { displayName, type DateRange, type PullRequestActivity } from './pull-request-source.js';
import { checkPeriod, pooledPullRequests, type MetricPorts } from './query-metric.js';
import { DAY_PERIOD_MAX_MONTHS, exceedsDayPeriodLimit, previousRangeOf, resolveRange } from './range.js';
import type { WorkSchedule } from './work-schedule.js';
import { definitionsOf, type MetricDefinition } from './registry.js';

export interface DashboardRequest {
  family: string;
  period: string;
  since?: string | undefined;
  until?: string | undefined;
  workSchedule?: WorkSchedule | undefined;
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
  dayPeriodMaxMonths: number;
  repositories: string[];
  workSchedule?: WorkSchedule;
  metrics: DashboardMetric[];
}

function summaryOf(definition: MetricDefinition, pullRequests: PullRequestActivity[], schedule: WorkSchedule | undefined): DashboardSummary {
  const n = pullRequests.length;
  const values = Object.fromEntries(definition.statistics.map((statistic) => [statistic, definition.calculate(pullRequests, statistic, schedule)]));
  return definition.perPullRequest && isLowSample(n) ? { n, values, lowSample: true } : { n, values };
}

interface Pools {
  period: string;
  range: DateRange;
  current: PullRequestActivity[];
  previous: PullRequestActivity[];
  workSchedule: WorkSchedule | undefined;
}

function metricOf(definition: MetricDefinition, pools: Pools, now: Date): DashboardMetric {
  const rows = bucketsOf(pools.period, pools.range, pools.current, now).map((bucket) => {
    const row: DashboardRow = { period: bucket.label, ...summaryOf(definition, bucket.pullRequests, pools.workSchedule) };
    return bucket.inProgress ? { ...row, inProgress: true as const } : row;
  });
  const tiles = { current: summaryOf(definition, pools.current, pools.workSchedule), previous: summaryOf(definition, pools.previous, pools.workSchedule) };
  return definition.unit ? { id: definition.id, unit: definition.unit, rows, tiles } : { id: definition.id, rows, tiles };
}

export async function queryDashboard(ports: MetricPorts, request: DashboardRequest, now: Date, onProgress: ProgressListener = () => undefined): Promise<Dashboard> {
  const definitions = definitionsOf(request.family);
  if (definitions.length === 0) throw new UsageError(`Unknown family "${request.family}"`);
  checkPeriod(request.period);
  const range = resolveRange(request.period, request.since, request.until, now);
  if (request.period === 'daily' && exceedsDayPeriodLimit(range)) {
    throw new UsageError(`The day period needs a range of at most ${DAY_PERIOD_MAX_MONTHS} months`);
  }
  const previousRange = previousRangeOf(range);
  const repositories = await ports.repositories.find();
  const onMonthFetched = trackMonths([range, previousRange], repositories, onProgress);
  const current = await pooledPullRequests(ports.pullRequests, repositories, range, onMonthFetched);
  const previous = await pooledPullRequests(ports.pullRequests, repositories, previousRange, onMonthFetched);
  const metrics = definitions.map((definition) => metricOf(definition, { period: request.period, range, current, previous, workSchedule: request.workSchedule }, now));
  return {
    range,
    previousRange,
    n: current.length,
    fetchedAt: now.toISOString(),
    lowSampleThreshold: LOW_SAMPLE_THRESHOLD,
    dayPeriodMaxMonths: DAY_PERIOD_MAX_MONTHS,
    repositories: repositories.map(displayName),
    ...(request.workSchedule ? { workSchedule: request.workSchedule } : {}),
    metrics,
  };
}

export interface RepositoryOption {
  path: string;
  name: string;
}
