import { isHumanReviewer } from './human-reviewer.js';
import type { PullRequestActivity } from './pull-request-source.js';

const MS_PER_HOUR = 60 * 60 * 1000;

function readyForReviewAt(pullRequest: PullRequestActivity): string {
  const [firstDraftEvent] = pullRequest.draftEvents;
  return firstDraftEvent?.kind === 'ready_for_review' ? firstDraftEvent.at : pullRequest.createdAt;
}

function firstResponseTime(pullRequest: PullRequestActivity): number {
  const ready = Date.parse(readyForReviewAt(pullRequest));
  const merged = Date.parse(pullRequest.mergedAt);
  const responseTimes = [...pullRequest.comments, ...pullRequest.reviews]
    .filter((activity) => isHumanReviewer(pullRequest, activity.actor))
    .map((activity) => Date.parse(activity.at))
    .filter((time) => time >= ready && time < merged);
  return Math.min(merged, ...responseTimes);
}

function hoursBetween(start: string, end: number): number {
  return (end - Date.parse(start)) / MS_PER_HOUR;
}

export function reviewWaitingHours(pullRequest: PullRequestActivity): number {
  return hoursBetween(readyForReviewAt(pullRequest), firstResponseTime(pullRequest));
}

export function totalReviewHours(pullRequest: PullRequestActivity): number {
  return hoursBetween(readyForReviewAt(pullRequest), Date.parse(pullRequest.mergedAt));
}
