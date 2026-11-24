import {
  DataError,
  type DateRange,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '@fluxion/core';
import type { GithubApi } from './github-api.js';
import {
  GITHUB_SEARCH_RESULT_LIMIT,
  MERGED_PULL_REQUEST_COUNT_DOCUMENT,
  MERGED_PULL_REQUESTS_DOCUMENT,
  PULL_REQUEST_DOCUMENT,
  countVariables,
  pullRequestVariables,
  toPullRequest,
  searchVariables,
  toCount,
  toPage,
  type RateLimit,
  type MergedPullRequestsPage,
} from './merged-pull-requests-search.js';

function tooManyResults(repository: RepositoryRef, range: DateRange, count: number): DataError {
  return new DataError(
    `${repository.owner}/${repository.name} has ${count} merged pull requests between ${range.since} and ${range.until}, ` +
      `more than the ${GITHUB_SEARCH_RESULT_LIMIT} that GitHub search can return. Use a shorter range`,
  );
}

function rateLimitExhausted(rateLimit: RateLimit): DataError {
  return new DataError(
    `GitHub rate limit is too low to fetch the next page (${rateLimit.remaining} remaining). It resets at ${rateLimit.resetAt}`,
  );
}

export class GitHubPullRequestSource implements PullRequestSource {
  constructor(private readonly api: GithubApi) {}

  async mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    const found: PullRequestActivity[] = [];
    let cursor: string | null = null;
    do {
      const page: MergedPullRequestsPage = await this.fetchPage(repository, range, cursor);
      if (page.issueCount > GITHUB_SEARCH_RESULT_LIMIT) throw tooManyResults(repository, range, page.issueCount);
      found.push(...page.pullRequests);
      cursor = page.nextCursor;
      if (cursor && page.rateLimit.remaining < page.rateLimit.cost) throw rateLimitExhausted(page.rateLimit);
    } while (cursor);
    return found;
  }

  async countMergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<number> {
    return toCount(await this.api.executeApi(MERGED_PULL_REQUEST_COUNT_DOCUMENT, countVariables(repository, range)));
  }

  async pullRequest(repository: RepositoryRef, number: number): Promise<FetchedPullRequest | null> {
    const data = await this.api.executeApi(PULL_REQUEST_DOCUMENT, pullRequestVariables(repository, number));
    return toPullRequest(data);
  }

  private async fetchPage(repository: RepositoryRef, range: DateRange, cursor: string | null): Promise<MergedPullRequestsPage> {
    const data = await this.api.executeApi(MERGED_PULL_REQUESTS_DOCUMENT, searchVariables(repository, range, cursor));
    return toPage(data);
  }
}
