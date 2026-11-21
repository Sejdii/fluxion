import type { PullRequestActivity } from './pull-request-source.js';

export interface MetricDefinition {
  id: string;
  family: string;
  description: string;
  statistics: readonly string[];
  calculate(pullRequests: PullRequestActivity[]): number | null;
}

export interface MetricSummary {
  family: string;
  id: string;
  description: string;
  statistics: readonly string[];
}

const registry: readonly MetricDefinition[] = [
  {
    id: 'prsMerged',
    family: 'pr',
    description: 'Pull requests merged per period',
    statistics: ['total'],
    calculate: (pullRequests) => pullRequests.length,
  },
];

export function listMetrics(): MetricSummary[] {
  return registry.map(({ family, id, description, statistics }) => ({ family, id, description, statistics }));
}

export function listMetricsOf(family: string): MetricSummary[] {
  return listMetrics().filter((metric) => metric.family === family);
}

export function listFamilies(): string[] {
  return [...new Set(registry.map((metric) => metric.family))];
}

export function findMetric(family: string, id: string): MetricDefinition | undefined {
  return registry.find((metric) => metric.family === family && metric.id === id);
}
