import {
  DataError,
  type DateRange,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '@fluxion/core';
import type { GithubApi } from './github-api.js';
import {
  GITHUB_SEARCH_RESULT_LIMIT,
  MERGED_PULL_REQUESTS_DOCUMENT,
  searchVariables,
  toPage,
  type MergedPullRequestsPage,
} from './merged-pull-requests-search.js';

function tooManyResults(repository: RepositoryRef, range: DateRange, count: number): DataError {
  return new DataError(
    `${repository.owner}/${repository.name} has ${count} merged pull requests between ${range.since} and ${range.until}, ` +
      `more than the ${GITHUB_SEARCH_RESULT_LIMIT} that GitHub search can return. Use a shorter range`,
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
    } while (cursor);
    return found;
  }

  private async fetchPage(repository: RepositoryRef, range: DateRange, cursor: string | null): Promise<MergedPullRequestsPage> {
    const data = await this.api.executeApi(MERGED_PULL_REQUESTS_DOCUMENT, searchVariables(repository, range, cursor));
    return toPage(data);
  }
}
