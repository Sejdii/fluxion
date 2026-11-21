import type { DashboardMetric, DashboardSummary } from '@fluxion/core';

export const METRIC_NAMES: Record<string, string> = {
  reviewWaitingTime: 'Review waiting time',
  totalReviewTime: 'Total review time',
  prsMerged: 'PRs merged',
  prSize: 'PR size',
  comments: 'Comments',
  reviewers: 'Reviewers',
};

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
