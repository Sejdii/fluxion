import { GithubCliExecutor, GitHubPullRequestSource, resolveCurrentRepository } from '@fluxion/adapters';
import { CachingPullRequestSource, InMemoryCache, queryMetric, type MetricPorts } from '@fluxion/core';
import type { RunMetric } from './program.js';

export function createRunMetric(directory: string, now: () => Date): RunMetric {
  const ports: MetricPorts = {
    pullRequests: new CachingPullRequestSource(new GitHubPullRequestSource(new GithubCliExecutor()), new InMemoryCache()),
    repositories: { current: () => resolveCurrentRepository(directory) },
  };
  return (request) => queryMetric(ports, request, now());
}
