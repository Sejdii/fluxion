import type { Actor, DateRange, DraftEvent, PullRequestActivity, RepositoryRef, ReviewActivity, ReviewSubmission } from '@fluxion/core';
import type { GraphqlVariables } from './github-api.js';

const PAGE_SIZE = 100;
const NESTED_PAGE_SIZE = 100;
// Threads multiply: 100 PRs x 20 threads x 20 comments keeps the query far below GitHub's 500,000 node limit.
const THREAD_PAGE_SIZE = 20;

export const GITHUB_SEARCH_RESULT_LIMIT = 1000;

export const MERGED_PULL_REQUESTS_DOCUMENT = `
query($searchQuery: String!, $cursor: String) {
  rateLimit { cost remaining resetAt }
  search(query: $searchQuery, type: ISSUE, first: ${PAGE_SIZE}, after: $cursor) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        createdAt
        mergedAt
        additions
        deletions
        author { login __typename }
        timelineItems(first: ${NESTED_PAGE_SIZE}, itemTypes: [READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT]) {
          nodes {
            __typename
            ... on ReadyForReviewEvent { createdAt }
            ... on ConvertToDraftEvent { createdAt }
          }
        }
        comments(first: ${NESTED_PAGE_SIZE}) { nodes { createdAt author { login __typename } } }
        reviews(first: ${NESTED_PAGE_SIZE}) { nodes { submittedAt body author { login __typename } } }
        reviewThreads(first: ${THREAD_PAGE_SIZE}) {
          nodes { comments(first: ${NESTED_PAGE_SIZE}) { nodes { createdAt author { login __typename } } } }
        }
      }
    }
  }
}`;

interface ActorNode {
  login: string;
  __typename: string;
}

interface SearchNode {
  number: number;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  author: ActorNode | null;
  timelineItems: { nodes: { __typename: string; createdAt: string }[] };
  comments: { nodes: { createdAt: string; author: ActorNode | null }[] };
  reviews: { nodes: { submittedAt: string | null; body: string; author: ActorNode | null }[] };
  reviewThreads: { nodes: { comments: { nodes: { createdAt: string; author: ActorNode | null }[] } }[] };
}

export interface RateLimit {
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface MergedPullRequestsPage {
  rateLimit: RateLimit;
  issueCount: number;
  nextCursor: string | null;
  pullRequests: PullRequestActivity[];
}

interface SearchData {
  rateLimit: RateLimit;
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: SearchNode[];
  };
}

export function searchVariables(repository: RepositoryRef, range: DateRange, cursor: string | null): GraphqlVariables {
  const searchQuery = `repo:${repository.owner}/${repository.name} is:pr is:merged merged:${range.since}..${range.until}`;
  return cursor ? { searchQuery, cursor } : { searchQuery };
}

function toActor(author: ActorNode | null): Actor {
  return author && { login: author.login, isBot: author.__typename === 'Bot' };
}

function toDraftEvent(node: { __typename: string; createdAt: string }): DraftEvent {
  return { kind: node.__typename === 'ReadyForReviewEvent' ? 'ready_for_review' : 'converted_to_draft', at: node.createdAt };
}

function toReviews(nodes: SearchNode['reviews']['nodes']): ReviewSubmission[] {
  return nodes.flatMap((node) =>
    node.submittedAt ? [{ actor: toActor(node.author), at: node.submittedAt, hasBody: node.body.trim() !== '' }] : [],
  );
}

function toReviewComments(threads: SearchNode['reviewThreads']['nodes']): ReviewActivity[] {
  return threads.flatMap((thread) => thread.comments.nodes.map((comment) => ({ actor: toActor(comment.author), at: comment.createdAt })));
}

function toActivity(node: SearchNode): PullRequestActivity {
  return {
    number: node.number,
    author: toActor(node.author),
    createdAt: node.createdAt,
    mergedAt: node.mergedAt,
    additions: node.additions,
    deletions: node.deletions,
    draftEvents: node.timelineItems.nodes.map(toDraftEvent),
    comments: node.comments.nodes.map((comment) => ({ actor: toActor(comment.author), at: comment.createdAt })),
    reviewComments: toReviewComments(node.reviewThreads.nodes),
    reviews: toReviews(node.reviews.nodes),
  };
}

export function toPage(raw: unknown): MergedPullRequestsPage {
  const data = raw as SearchData;
  const { search } = data;
  return {
    rateLimit: data.rateLimit,
    issueCount: search.issueCount,
    nextCursor: search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null,
    pullRequests: search.nodes.map(toActivity),
  };
}
