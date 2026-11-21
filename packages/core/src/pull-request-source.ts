export interface RepositoryRef {
  host: 'github';
  owner: string;
  name: string;
}

export interface DateRange {
  since: string;
  until: string;
}

export interface PullRequestActivity {
  number: number;
  author: { login: string; isBot: boolean } | null;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
}

export interface PullRequestSource {
  mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]>;
}

export function repositoryKey(repository: RepositoryRef): string {
  return `${repository.host}:${repository.owner}/${repository.name}`;
}

export interface RepositoryFinder {
  current(): Promise<RepositoryRef>;
}
