import { DataError, UsageError } from './errors.js';
import { commentCount, reviewerLogins } from './discussion.js';
import {
  displayName,
  type FetchedPullRequest,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryFinder,
  type RepositoryRef,
} from './pull-request-source.js';
import { firstResponseOf, readyForReviewAt, type FirstResponse } from './review-time.js';
import { valuesOfPullRequest, type MetricValue } from './registry.js';

export interface ExplainPorts {
  pullRequests: PullRequestSource;
  repositories: RepositoryFinder;
}

export interface ExplainRequest {
  number: number;
}

export interface PullRequestFacts {
  readyForReviewAt: string;
  firstResponse: FirstResponse | null;
  mergedAt: string | null;
  comments: number;
  reviewers: string[];
}

export interface Explanation {
  number: number;
  facts: PullRequestFacts;
  values: MetricValue[] | null;
}

function isMerged(pullRequest: FetchedPullRequest): pullRequest is PullRequestActivity {
  return pullRequest.mergedAt !== null;
}

async function onlyRepository(finder: RepositoryFinder): Promise<RepositoryRef> {
  const [first, ...others] = await finder.find();
  if (first && others.length === 0) return first;
  const found = [first, ...others].filter((repository) => repository !== undefined);
  throw new UsageError(`explain works on exactly one repository, found ${found.length}: ${found.map(displayName).join(', ')}`);
}

export async function explainPullRequest(ports: ExplainPorts, request: ExplainRequest): Promise<Explanation> {
  const repository = await onlyRepository(ports.repositories);
  const pullRequest = await ports.pullRequests.pullRequest(repository, request.number);
  if (!pullRequest) throw new DataError(`Pull request #${request.number} was not found in ${displayName(repository)}`);
  return {
    number: pullRequest.number,
    facts: {
      readyForReviewAt: readyForReviewAt(pullRequest),
      firstResponse: firstResponseOf(pullRequest),
      mergedAt: pullRequest.mergedAt,
      comments: commentCount(pullRequest),
      reviewers: reviewerLogins(pullRequest),
    },
    values: isMerged(pullRequest) ? valuesOfPullRequest('pr', pullRequest) : null,
  };
}
