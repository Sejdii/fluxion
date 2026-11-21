export interface RepositoryRef {
  host: 'github';
  owner: string;
  name: string;
}

export interface DateRange {
  since: string;
  until: string;
}

export type Actor = { login: string; isBot: boolean } | null;

export interface DraftEvent {
  kind: 'ready_for_review' | 'converted_to_draft';
  at: string;
}

export interface ReviewActivity {
  actor: Actor;
  at: string;
}

export interface ReviewSubmission extends ReviewActivity {
  hasBody: boolean;
}

export interface PullRequestActivity {
  number: number;
  author: Actor;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  draftEvents: DraftEvent[];
  comments: ReviewActivity[];
  reviewComments: ReviewActivity[];
  reviews: ReviewSubmission[];
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
