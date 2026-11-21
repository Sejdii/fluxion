import type { DateRange, PullRequestActivity, RepositoryRef } from '@fluxion/core';
import type { GraphqlVariables } from './github-api.js';

const PAGE_SIZE = 100;

export const GITHUB_SEARCH_RESULT_LIMIT = 1000;

export const MERGED_PULL_REQUESTS_DOCUMENT = `
query($searchQuery: String!, $cursor: String) {
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
      }
    }
  }
}`;

interface SearchNode {
  number: number;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  author: { login: string; __typename: string } | null;
}

export interface MergedPullRequestsPage {
  issueCount: number;
  nextCursor: string | null;
  pullRequests: PullRequestActivity[];
}

interface SearchData {
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

function toActivity(node: SearchNode): PullRequestActivity {
  return {
    number: node.number,
    author: node.author && { login: node.author.login, isBot: node.author.__typename === 'Bot' },
    createdAt: node.createdAt,
    mergedAt: node.mergedAt,
    additions: node.additions,
    deletions: node.deletions,
  };
}

export function toPage(data: unknown): MergedPullRequestsPage {
  const { search } = data as SearchData;
  return {
    issueCount: search.issueCount,
    nextCursor: search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null,
    pullRequests: search.nodes.map(toActivity),
  };
}
