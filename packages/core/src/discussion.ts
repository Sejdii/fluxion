import { isHuman, isHumanReviewer } from './human-reviewer.js';
import type { PullRequestActivity } from './pull-request-source.js';

const DELETED_ACCOUNT = '(deleted account)';

export function prSize(pullRequest: PullRequestActivity): number {
  return pullRequest.additions + pullRequest.deletions;
}

export function commentCount(pullRequest: PullRequestActivity): number {
  const reviewBodies = pullRequest.reviews.filter((review) => review.hasBody);
  return [...pullRequest.comments, ...pullRequest.reviewComments, ...reviewBodies].filter((activity) => isHuman(activity.actor)).length;
}

export function reviewerCount(pullRequest: PullRequestActivity): number {
  const responses = [...pullRequest.comments, ...pullRequest.reviewComments, ...pullRequest.reviews];
  const reviewers = responses.filter((activity) => isHumanReviewer(pullRequest, activity.actor));
  return new Set(reviewers.map((activity) => activity.actor?.login ?? DELETED_ACCOUNT)).size;
}
