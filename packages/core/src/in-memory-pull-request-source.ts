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
  fetches = 0;

  failWith(error: Error | null): void {
    this.failure = error;
  }

  set(repository: RepositoryRef, pullRequests: FetchedPullRequest[]): void {
    this.byRepository.set(repositoryKey(repository), pullRequests);
  }

  mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    this.fetches += 1;
    if (this.failure) return Promise.reject(this.failure);
    const all = this.byRepository.get(repositoryKey(repository)) ?? [];
    const inRange = all.filter((pr): pr is PullRequestActivity => {
      if (pr.mergedAt === null) return false;
      const mergeDate = pr.mergedAt.slice(0, 10);
      return mergeDate >= range.since && mergeDate <= range.until;
    });
    return Promise.resolve(inRange);
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
