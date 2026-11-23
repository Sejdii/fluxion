import type { Cache } from './cache.js';
import { mapWithConcurrency } from './concurrency.js';
import { isoDate } from './dates.js';
import { monthChunks } from './month-chunks.js';
import {
  repositoryKey,
  type DateRange,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from './pull-request-source.js';

export const IN_PROGRESS_TTL_MINUTES = 30;
const MAX_CONCURRENT_MONTHS = 3;
const MINUTE_MS = 60 * 1000;
const MONTH_LABEL_LENGTH = 7;
const DATE_LENGTH = 10;

interface CachedMonth {
  fetchedAt: number;
  pullRequests: PullRequestActivity[];
}

function cacheKey(repository: RepositoryRef, month: DateRange): string {
  return `${repositoryKey(repository)}|${month.since.slice(0, MONTH_LABEL_LENGTH)}`;
}

function mergedWithin(range: DateRange): (pullRequest: PullRequestActivity) => boolean {
  return ({ mergedAt }) => {
    const mergeDate = mergedAt.slice(0, DATE_LENGTH);
    return mergeDate >= range.since && mergeDate <= range.until;
  };
}

export class CachingPullRequestSource implements PullRequestSource {
  private readonly inFlight = new Map<string, Promise<PullRequestActivity[]>>();
  private generation = 0;

  constructor(
    private readonly source: PullRequestSource,
    private readonly cache: Cache<CachedMonth>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    const months = await mapWithConcurrency(monthChunks(range), MAX_CONCURRENT_MONTHS, (month) => this.cachedMonth(repository, month));
    return months.flat().filter(mergedWithin(range));
  }

  countMergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<number> {
    return this.source.countMergedPullRequests(repository, range);
  }

  pullRequest(repository: RepositoryRef, number: number): Promise<FetchedPullRequest | null> {
    return this.source.pullRequest(repository, number);
  }

  async clear(): Promise<void> {
    this.generation += 1;
    this.inFlight.clear();
    await this.cache.clear();
  }

  private async cachedMonth(repository: RepositoryRef, month: DateRange): Promise<PullRequestActivity[]> {
    const key = cacheKey(repository, month);
    const cached = await this.cache.get(key);
    if (cached && this.isFresh(cached, month)) return cached.pullRequests;
    const pending = this.inFlight.get(key) ?? this.fetchAndStore(key, repository, month);
    this.inFlight.set(key, pending);
    return pending;
  }

  private isFresh(cached: CachedMonth, month: DateRange): boolean {
    const fetchedAfterTheMonthEnded = isoDate(new Date(cached.fetchedAt)) > month.until;
    return fetchedAfterTheMonthEnded || this.now().getTime() - cached.fetchedAt < IN_PROGRESS_TTL_MINUTES * MINUTE_MS;
  }

  private async fetchAndStore(key: string, repository: RepositoryRef, month: DateRange): Promise<PullRequestActivity[]> {
    const generation = this.generation;
    try {
      const fetched = await this.source.mergedPullRequests(repository, month);
      if (generation === this.generation) await this.cache.set(key, { fetchedAt: this.now().getTime(), pullRequests: fetched });
      return fetched;
    } finally {
      if (generation === this.generation) this.inFlight.delete(key);
    }
  }
}
