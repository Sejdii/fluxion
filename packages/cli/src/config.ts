import { resolve } from 'node:path';
import { GithubCliExecutor, GitHubPullRequestSource, resolveCurrentRepository } from '@fluxion/adapters';
import { CachingPullRequestSource, InMemoryCache, explainPullRequest, queryMetric, type MetricPorts } from '@fluxion/core';
import type { Runners } from './program.js';

export function createRunners(directory: string, now: () => Date): Runners {
  const pullRequests = new CachingPullRequestSource(new GitHubPullRequestSource(new GithubCliExecutor()), new InMemoryCache());
  const portsFor = (repositoryDirectory: string): MetricPorts => ({
    pullRequests,
    repositories: { current: () => resolveCurrentRepository(repositoryDirectory) },
  });
  return {
    metric: (request) => queryMetric(portsFor(directory), request, now()),
    explain: (request) => explainPullRequest(portsFor(resolve(directory, request.repository ?? '.')), { number: request.number }),
  };
}
