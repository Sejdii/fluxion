import {
  repositoryKey,
  type DateRange,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryFinder,
  type RepositoryRef,
} from './pull-request-source.js';

export class InMemoryPullRequestSource implements PullRequestSource {
  private readonly byRepository = new Map<string, PullRequestActivity[]>();

  set(repository: RepositoryRef, pullRequests: PullRequestActivity[]): void {
    this.byRepository.set(repositoryKey(repository), pullRequests);
  }

  mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    const all = this.byRepository.get(repositoryKey(repository)) ?? [];
    const inRange = all.filter((pr) => {
      const mergeDate = pr.mergedAt.slice(0, 10);
      return mergeDate >= range.since && mergeDate <= range.until;
    });
    return Promise.resolve(inRange);
  }
}

export class InMemoryRepositoryFinder implements RepositoryFinder {
  constructor(private readonly repository: RepositoryRef) {}

  current(): Promise<RepositoryRef> {
    return Promise.resolve(this.repository);
  }
}
