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

  set(repository: RepositoryRef, pullRequests: FetchedPullRequest[]): void {
    this.byRepository.set(repositoryKey(repository), pullRequests);
  }

  mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
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
  constructor(private readonly repository: RepositoryRef) {}

  current(): Promise<RepositoryRef> {
    return Promise.resolve(this.repository);
  }
}
