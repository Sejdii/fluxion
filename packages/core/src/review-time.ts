import { DELETED_ACCOUNT, isHumanReviewer } from './human-reviewer.js';
import type { FetchedPullRequest, PullRequestActivity, ReviewActivity } from './pull-request-source.js';

const MS_PER_HOUR = 60 * 60 * 1000;

export type FirstResponse = { kind: 'human'; by: string; at: string } | { kind: 'merge'; at: string };

export function readyForReviewAt(pullRequest: FetchedPullRequest): string {
  const [firstDraftEvent] = pullRequest.draftEvents;
  return firstDraftEvent?.kind === 'ready_for_review' ? firstDraftEvent.at : pullRequest.createdAt;
}

function firstHumanResponse(pullRequest: FetchedPullRequest): ReviewActivity | undefined {
  const ready = Date.parse(readyForReviewAt(pullRequest));
  const merged = pullRequest.mergedAt === null ? Infinity : Date.parse(pullRequest.mergedAt);
  const [first] = [...pullRequest.comments, ...pullRequest.reviews]
    .filter((activity) => isHumanReviewer(pullRequest, activity.actor))
    .filter((activity) => Date.parse(activity.at) >= ready && Date.parse(activity.at) < merged)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return first;
}

export function firstResponseOf(pullRequest: FetchedPullRequest): FirstResponse | null {
  const first = firstHumanResponse(pullRequest);
  if (first) return { kind: 'human', by: first.actor?.login ?? DELETED_ACCOUNT, at: first.at };
  return pullRequest.mergedAt === null ? null : { kind: 'merge', at: pullRequest.mergedAt };
}

function hoursBetween(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / MS_PER_HOUR;
}

export function reviewWaitingHours(pullRequest: PullRequestActivity): number {
  return hoursBetween(readyForReviewAt(pullRequest), firstHumanResponse(pullRequest)?.at ?? pullRequest.mergedAt);
}

export function totalReviewHours(pullRequest: PullRequestActivity): number {
  return hoursBetween(readyForReviewAt(pullRequest), pullRequest.mergedAt);
}
