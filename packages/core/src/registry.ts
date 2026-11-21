import type { PullRequestActivity } from './pull-request-source.js';
import { commentCount, prSize, reviewerCount } from './discussion.js';
import { reviewWaitingHours, totalReviewHours } from './review-time.js';
import { summarize } from './statistics.js';

export interface MetricDefinition {
  id: string;
  family: string;
  description: string;
  statistics: readonly [string, ...string[]];
  unit?: string;
  perPullRequest: boolean;
  calculate(pullRequests: PullRequestActivity[], statistic: string): number | null;
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
    perPullRequest: false,
    calculate: (pullRequests) => pullRequests.length,
  },
  {
    id: 'reviewWaitingTime',
    family: 'pr',
    description: 'Hours from ready for review to first response',
    statistics: ['median', 'p90'],
    unit: 'hours',
    perPullRequest: true,
    calculate: (pullRequests, statistic) => summarize(pullRequests.map(reviewWaitingHours), statistic),
  },
  {
    id: 'totalReviewTime',
    family: 'pr',
    description: 'Hours from ready for review to merge',
    statistics: ['median', 'p90'],
    unit: 'hours',
    perPullRequest: true,
    calculate: (pullRequests, statistic) => summarize(pullRequests.map(totalReviewHours), statistic),
  },
  {
    id: 'prSize',
    family: 'pr',
    description: 'Lines added plus lines deleted',
    statistics: ['median', 'p90'],
    unit: 'lines',
    perPullRequest: true,
    calculate: (pullRequests, statistic) => summarize(pullRequests.map(prSize), statistic),
  },
  {
    id: 'comments',
    family: 'pr',
    description: 'Human comments per pull request',
    statistics: ['median', 'p90'],
    perPullRequest: true,
    calculate: (pullRequests, statistic) => summarize(pullRequests.map(commentCount), statistic),
  },
  {
    id: 'reviewers',
    family: 'pr',
    description: 'Distinct human reviewers per pull request',
    statistics: ['median', 'p90'],
    perPullRequest: true,
    calculate: (pullRequests, statistic) => summarize(pullRequests.map(reviewerCount), statistic),
  },
];

export function listMetrics(): MetricSummary[] {
  return registry.map(({ family, id, description, statistics }) => ({ family, id, description, statistics }));
}

export function listMetricsOf(family: string): MetricSummary[] {
  return listMetrics().filter((metric) => metric.family === family);
}

export function definitionsOf(family: string): MetricDefinition[] {
  return registry.filter((metric) => metric.family === family);
}

export function listFamilies(): string[] {
  return [...new Set(registry.map((metric) => metric.family))];
}

export function findMetric(family: string, id: string): MetricDefinition | undefined {
  return registry.find((metric) => metric.family === family && metric.id === id);
}

export interface MetricValue {
  metric: string;
  unit?: string;
  value: number | null;
}

export function valuesOfPullRequest(family: string, pullRequest: PullRequestActivity): MetricValue[] {
  return registry
    .filter((definition) => definition.family === family)
    .map((definition) => {
      const value = definition.calculate([pullRequest], definition.statistics[0]);
      return definition.unit ? { metric: definition.id, unit: definition.unit, value } : { metric: definition.id, value };
    });
}
