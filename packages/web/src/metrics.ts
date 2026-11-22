import type { DashboardMetric, DashboardRow, DashboardSummary } from '@fluxion/core';
import type { ChartPeriod } from './chart/index.js';

export const METRIC_NAMES: Record<string, string> = {
  reviewWaitingTime: 'Review waiting time',
  totalReviewTime: 'Total review time',
  prsMerged: 'PRs merged',
  prSize: 'PR size',
  comments: 'Comments',
  reviewers: 'Reviewers',
};

export type Preference = 'lower' | 'higher' | 'neutral';

const PREFERENCES: Record<string, Preference> = {
  reviewWaitingTime: 'lower',
  totalReviewTime: 'lower',
  prsMerged: 'higher',
};

export function preferenceOf(metric: DashboardMetric): Preference {
  return PREFERENCES[metric.id] ?? 'neutral';
}

export function nameOf(metric: DashboardMetric): string {
  return METRIC_NAMES[metric.id] ?? metric.id;
}

export function isTotal(metric: DashboardMetric): boolean {
  return metric.tiles.current.values['total'] !== undefined;
}

export function headlineOf(metric: DashboardMetric, summary: DashboardSummary): number | null {
  return summary.values[isTotal(metric) ? 'total' : 'median'] ?? null;
}

export function inRailOrder(metrics: DashboardMetric[]): DashboardMetric[] {
  const position = (metric: DashboardMetric): number => Object.keys(METRIC_NAMES).indexOf(metric.id);
  return [...metrics].sort((a, b) => position(a) - position(b));
}

export function chartPeriodsOf(metric: DashboardMetric): ChartPeriod[] {
  const total = isTotal(metric);
  return metric.rows.map((row: DashboardRow) => ({
    period: row.period,
    n: row.n,
    median: row.values[total ? 'total' : 'median'] ?? null,
    p90: row.values['p90'] ?? null,
    lowSample: row.lowSample === true,
    inProgress: row.inProgress === true,
  }));
}
