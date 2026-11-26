import type { Actor, DateRange, DraftEvent, FetchedPullRequest, PullRequestActivity, RepositoryRef, ReviewActivity, ReviewSubmission } from '@fluxion/core';
import type { GraphqlVariables } from './github-api.js';

const PAGE_SIZE = 50;
const NESTED_PAGE_SIZE = 100;
// Threads multiply: 50 PRs x 20 threads x 20 comments keeps the query far below GitHub's 500,000 node limit.
const THREAD_PAGE_SIZE = 20;

export const GITHUB_SEARCH_RESULT_LIMIT = 1000;

const PULL_REQUEST_FIELDS = `
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
        }`;

export const MERGED_PULL_REQUESTS_DOCUMENT = `
query($searchQuery: String!, $cursor: String) {
  rateLimit { cost remaining resetAt }
  search(query: $searchQuery, type: ISSUE, first: ${PAGE_SIZE}, after: $cursor) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {${PULL_REQUEST_FIELDS}
      }
    }
  }
}`;

export const MERGED_PULL_REQUEST_COUNT_DOCUMENT = `
query($searchQuery: String!) {
  search(query: $searchQuery, type: ISSUE, first: 0) {
    issueCount
  }
}`;

export const PULL_REQUEST_DOCUMENT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {${PULL_REQUEST_FIELDS}
    }
  }
}`;

interface ActorNode {
  login: string;
  __typename: string;
}

interface PullRequestNode {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  author: ActorNode | null;
  timelineItems: { nodes: { __typename: string; createdAt: string }[] };
  comments: { nodes: { createdAt: string; author: ActorNode | null }[] };
  reviews: { nodes: { submittedAt: string | null; body: string; author: ActorNode | null }[] };
  reviewThreads: { nodes: { comments: { nodes: { createdAt: string; author: ActorNode | null }[] } }[] };
}

type SearchNode = PullRequestNode & { mergedAt: string };

export interface RateLimit {
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface MergedPullRequestsPage {
  rateLimit: RateLimit | null;
  issueCount: number;
  nextCursor: string | null;
  pullRequests: PullRequestActivity[];
}

interface SearchData {
  rateLimit: RateLimit | null;
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: SearchNode[];
  };
}

function searchQueryOf(repository: RepositoryRef, range: DateRange): string {
  return `repo:${repository.owner}/${repository.name} is:pr is:merged merged:${range.since}..${range.until}`;
}

export function countVariables(repository: RepositoryRef, range: DateRange): GraphqlVariables {
  return { searchQuery: searchQueryOf(repository, range) };
}

export function toCount(raw: unknown): number {
  return (raw as { search: { issueCount: number } }).search.issueCount;
}

export function searchVariables(repository: RepositoryRef, range: DateRange, cursor: string | null): GraphqlVariables {
  const searchQuery = searchQueryOf(repository, range);
  return cursor ? { searchQuery, cursor } : { searchQuery };
}

function toActor(author: ActorNode | null): Actor {
  return author && { login: author.login, isBot: author.__typename === 'Bot' };
}

function toDraftEvent(node: { __typename: string; createdAt: string }): DraftEvent {
  return { kind: node.__typename === 'ReadyForReviewEvent' ? 'ready_for_review' : 'converted_to_draft', at: node.createdAt };
}

function toReviews(nodes: PullRequestNode['reviews']['nodes']): ReviewSubmission[] {
  return nodes.flatMap((node) =>
    node.submittedAt ? [{ actor: toActor(node.author), at: node.submittedAt, hasBody: node.body.trim() !== '' }] : [],
  );
}

function toReviewComments(threads: PullRequestNode['reviewThreads']['nodes']): ReviewActivity[] {
  return threads.flatMap((thread) => thread.comments.nodes.map((comment) => ({ actor: toActor(comment.author), at: comment.createdAt })));
}

function toFetched(node: PullRequestNode): FetchedPullRequest {
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

function toActivity(node: SearchNode): PullRequestActivity {
  return { ...toFetched(node), mergedAt: node.mergedAt };
}

export function toPullRequest(raw: unknown): FetchedPullRequest | null {
  const { repository } = raw as { repository: { pullRequest: PullRequestNode | null } | null };
  const node = repository?.pullRequest;
  return node ? toFetched(node) : null;
}

export function pullRequestVariables(repository: RepositoryRef, number: number): GraphqlVariables {
  return { owner: repository.owner, name: repository.name, number };
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
