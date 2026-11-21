import type { Cache } from './cache.js';
import {
  repositoryKey,
  type DateRange,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from './pull-request-source.js';

function cacheKey(repository: RepositoryRef, range: DateRange): string {
  return `${repositoryKey(repository)}|${range.since}|${range.until}`;
}

export class CachingPullRequestSource implements PullRequestSource {
  private readonly inFlight = new Map<string, Promise<PullRequestActivity[]>>();

  constructor(
    private readonly source: PullRequestSource,
    private readonly cache: Cache<PullRequestActivity[]>,
  ) {}

  async mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    const key = cacheKey(repository, range);
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const pending = this.inFlight.get(key) ?? this.fetchAndStore(key, repository, range);
    this.inFlight.set(key, pending);
    return pending;
  }

  pullRequest(repository: RepositoryRef, number: number): Promise<FetchedPullRequest | null> {
    return this.source.pullRequest(repository, number);
  }

  clear(): Promise<void> {
    return this.cache.clear();
  }

  private async fetchAndStore(key: string, repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    try {
      const fetched = await this.source.mergedPullRequests(repository, range);
      await this.cache.set(key, fetched);
      return fetched;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
