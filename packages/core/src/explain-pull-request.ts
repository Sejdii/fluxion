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
import { workingHoursBetween, type WorkSchedule } from './work-schedule.js';
import { valuesOfPullRequest, type MetricValue } from './registry.js';

export interface ExplainPorts {
  pullRequests: PullRequestSource;
  repositories: RepositoryFinder;
}

export interface ExplainRequest {
  number: number;
  workSchedule?: WorkSchedule | undefined;
}

export interface PullRequestFacts {
  readyForReviewAt: string;
  firstResponse: FirstResponse | null;
  firstResponseWorkingHours?: number;
  mergedAt: string | null;
  comments: number;
  reviewers: string[];
}

export interface Explanation {
  number: number;
  facts: PullRequestFacts;
  values: MetricValue[] | null;
  workSchedule?: WorkSchedule;
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

function workingHoursToFirstResponse(pullRequest: FetchedPullRequest, schedule: WorkSchedule): number | undefined {
  const response = firstResponseOf(pullRequest);
  return response ? workingHoursBetween(schedule, readyForReviewAt(pullRequest), response.at) : undefined;
}

export async function explainPullRequest(ports: ExplainPorts, request: ExplainRequest): Promise<Explanation> {
  const repository = await onlyRepository(ports.repositories);
  const pullRequest = await ports.pullRequests.pullRequest(repository, request.number);
  if (!pullRequest) throw new DataError(`Pull request #${request.number} was not found in ${displayName(repository)}`);
  const schedule = request.workSchedule;
  const responseHours = schedule ? workingHoursToFirstResponse(pullRequest, schedule) : undefined;
  return {
    number: pullRequest.number,
    facts: {
      readyForReviewAt: readyForReviewAt(pullRequest),
      firstResponse: firstResponseOf(pullRequest),
      ...(responseHours === undefined ? {} : { firstResponseWorkingHours: responseHours }),
      mergedAt: pullRequest.mergedAt,
      comments: commentCount(pullRequest),
      reviewers: reviewerLogins(pullRequest),
    },
    values: isMerged(pullRequest) ? valuesOfPullRequest('pr', pullRequest, schedule) : null,
    ...(schedule ? { workSchedule: schedule } : {}),
  };
}
