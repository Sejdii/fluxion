import { GithubCliExecutor, GitHubPullRequestSource, resolveCurrentRepository } from '@fluxion/adapters';
import { queryMetric, type MetricPorts } from '@fluxion/core';
import type { RunMetric } from './program.js';

export function createRunMetric(directory: string, now: () => Date): RunMetric {
  const ports: MetricPorts = {
    pullRequests: new GitHubPullRequestSource(new GithubCliExecutor()),
    repositories: { current: () => resolveCurrentRepository(directory) },
  };
  return (request) => queryMetric(ports, request, now());
}
