import type { Cache } from './cache.js';
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
export const MAX_CONCURRENT_CHUNKS = 3;
const MINUTE_MS = 60 * 1000;

export interface CachedChunk {
  fetchedAt: number;
  pullRequests: PullRequestActivity[];
}

function cacheKey(repository: RepositoryRef, chunk: DateRange): string {
  return `${repositoryKey(repository)}|${chunk.since}|${chunk.until}`;
}

export class CachingPullRequestSource implements PullRequestSource {
  private readonly inFlight = new Map<string, Promise<PullRequestActivity[]>>();

  constructor(
    private readonly source: PullRequestSource,
    private readonly cache: Cache<CachedChunk>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    const chunks = monthChunks(range);
    const results: PullRequestActivity[][] = [];
    let next = 0;
    let failed = false;
    const worker = async (): Promise<void> => {
      while (!failed && next < chunks.length) {
        const index = next++;
        try {
          results[index] = await this.chunk(repository, chunks[index] as DateRange);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_CHUNKS, chunks.length) }, worker));
    return results.flat();
  }

  pullRequest(repository: RepositoryRef, number: number): Promise<FetchedPullRequest | null> {
    return this.source.pullRequest(repository, number);
  }

  clear(): Promise<void> {
    return this.cache.clear();
  }

  private async chunk(repository: RepositoryRef, chunk: DateRange): Promise<PullRequestActivity[]> {
    const key = cacheKey(repository, chunk);
    const cached = await this.cache.get(key);
    if (cached && this.isFresh(cached, chunk)) return cached.pullRequests;
    const pending = this.inFlight.get(key) ?? this.fetchAndStore(key, repository, chunk);
    this.inFlight.set(key, pending);
    return pending;
  }

  private isFresh(cached: CachedChunk, chunk: DateRange): boolean {
    const fetchedAfterTheChunkEnded = new Date(cached.fetchedAt).toISOString().slice(0, 10) > chunk.until;
    return fetchedAfterTheChunkEnded || this.now().getTime() - cached.fetchedAt < IN_PROGRESS_TTL_MINUTES * MINUTE_MS;
  }

  private async fetchAndStore(key: string, repository: RepositoryRef, chunk: DateRange): Promise<PullRequestActivity[]> {
    try {
      const fetched = await this.source.mergedPullRequests(repository, chunk);
      await this.cache.set(key, { fetchedAt: this.now().getTime(), pullRequests: fetched });
      return fetched;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
