import { GithubCliExecutor, GitHubPullRequestSource, findRepositories } from '@fluxion/adapters';
import { CachingPullRequestSource, InMemoryCache, explainPullRequest, queryMetric, type MetricPorts } from '@fluxion/core';
import type { Runners } from './program.js';

export function createRunners(directory: string, now: () => Date): Runners {
  const pullRequests = new CachingPullRequestSource(new GitHubPullRequestSource(new GithubCliExecutor()), new InMemoryCache());
  const portsFor = (repos: string[] | undefined): MetricPorts => ({
    pullRequests,
    repositories: { find: () => findRepositories(directory, repos) },
  });
  return {
    metric: ({ repos, ...request }) => queryMetric(portsFor(repos), request, now()),
    explain: ({ repos, number }) => explainPullRequest(portsFor(repos), { number }),
  };
}
