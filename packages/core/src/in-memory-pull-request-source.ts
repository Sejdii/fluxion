import { DataError } from './errors.js';
import {
  repositoryKey,
  type DateRange,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryFinder,
  type RepositoryRef,
} from './pull-request-source.js';

export class InMemoryPullRequestSource implements PullRequestSource {
  private readonly byRepository = new Map<string, FetchedPullRequest[]>();
  private failure: Error | null = null;
  private searchLimit = Infinity;
  private readonly monthFailures = new Map<string, Error>();
  fetches = 0;
  readonly requested: DateRange[] = [];

  failWith(error: Error | null): void {
    this.failure = error;
  }

  failMonth(month: string, error: Error | null): void {
    if (error) this.monthFailures.set(month, error);
    else this.monthFailures.delete(month);
  }

  limitSearchTo(count: number): void {
    this.searchLimit = count;
  }

  set(repository: RepositoryRef, pullRequests: FetchedPullRequest[]): void {
    this.byRepository.set(repositoryKey(repository), pullRequests);
  }

  private mergedIn(repository: RepositoryRef, range: DateRange): PullRequestActivity[] {
    const all = this.byRepository.get(repositoryKey(repository)) ?? [];
    return all.filter((pr): pr is PullRequestActivity => {
      if (pr.mergedAt === null) return false;
      const mergeDate = pr.mergedAt.slice(0, 10);
      return mergeDate >= range.since && mergeDate <= range.until;
    });
  }

  mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    this.fetches += 1;
    this.requested.push(range);
    if (this.failure) return Promise.reject(this.failure);
    const monthFailure = this.monthFailures.get(range.since.slice(0, 7));
    if (monthFailure) return Promise.reject(monthFailure);
    const inRange = this.mergedIn(repository, range);
    if (inRange.length > this.searchLimit) return Promise.reject(new DataError(`more than ${this.searchLimit} merged pull requests`));
    return Promise.resolve(inRange);
  }

  countMergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<number> {
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(this.mergedIn(repository, range).length);
  }

  pullRequest(repository: RepositoryRef, number: number): Promise<FetchedPullRequest | null> {
    const all = this.byRepository.get(repositoryKey(repository)) ?? [];
    return Promise.resolve(all.find((pr) => pr.number === number) ?? null);
  }
}

export class InMemoryRepositoryFinder implements RepositoryFinder {
  private readonly repositories: RepositoryRef[];

  constructor(...repositories: RepositoryRef[]) {
    this.repositories = repositories;
  }

  find(): Promise<RepositoryRef[]> {
    return Promise.resolve(this.repositories);
  }
}
