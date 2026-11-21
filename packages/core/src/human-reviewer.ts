import type { Actor, FetchedPullRequest } from './pull-request-source.js';

export function isHuman(actor: Actor): boolean {
  return actor === null || !actor.isBot;
}

export function isHumanReviewer(pullRequest: Pick<FetchedPullRequest, 'author'>, actor: Actor): boolean {
  if (actor === null) return true;
  return !actor.isBot && actor.login !== pullRequest.author?.login;
}
