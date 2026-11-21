import { GitHubPullRequestSource, resolveCurrentRepository } from '@fluxion/adapters';
import { queryMetric, type MetricPorts } from '@fluxion/core';
import type { RunMetric } from './program.js';

/** Composition root: wires the core to the real adapters. */
export function createRunMetric(directory: string, now: () => Date): RunMetric {
  const ports: MetricPorts = {
    pullRequests: new GitHubPullRequestSource(),
    repositories: { current: () => resolveCurrentRepository(directory) },
  };
  return (request) => queryMetric(ports, request, now());
}
