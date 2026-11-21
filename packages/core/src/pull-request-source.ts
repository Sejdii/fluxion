export interface RepositoryRef {
  host: 'github';
  owner: string;
  name: string;
}

/** Inclusive UTC dates, `YYYY-MM-DD`. */
export interface DateRange {
  since: string;
  until: string;
}

/** Host-neutral facts about one merged pull request (ADR 0002). Timestamps are ISO 8601 UTC. */
export interface PullRequestActivity {
  number: number;
  /** `null` when the account no longer exists. */
  author: { login: string; isBot: boolean } | null;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
}

export interface PullRequestSource {
  /** Pull requests of the repository merged within the range, by UTC merge date. */
  mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]>;
}

export function repositoryKey(repository: RepositoryRef): string {
  return `${repository.host}:${repository.owner}/${repository.name}`;
}

export interface RepositoryFinder {
  /** The repository the command runs against. Fails with a DataError when there is none. */
  current(): Promise<RepositoryRef>;
}
