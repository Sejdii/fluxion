import {
  DataError,
  type DateRange,
  type PullRequestActivity,
  type PullRequestSource,
  type RepositoryRef,
} from '@fluxion/core';
import { runGh } from './run-gh.js';

const PAGE_SIZE = 100;
/** GitHub search never returns more than this many results, however many pages are read. */
const SEARCH_RESULT_LIMIT = 1000;

const QUERY = `
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

interface SearchPage {
  issueCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: SearchNode[];
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

interface GraphqlResponse {
  data?: { search: SearchPage };
  errors?: { message: string }[];
}

function parseResponse(output: string): GraphqlResponse {
  try {
    return JSON.parse(output) as GraphqlResponse;
  } catch {
    throw new DataError('gh returned a response that is not valid JSON');
  }
}

async function fetchPage(searchQuery: string, cursor: string | null): Promise<SearchPage> {
  const args = ['api', 'graphql', '-f', `query=${QUERY}`, '-f', `searchQuery=${searchQuery}`];
  if (cursor) args.push('-f', `cursor=${cursor}`);
  const response = parseResponse(await runGh(args));
  if (!response.data) {
    throw new DataError(`GitHub returned errors: ${(response.errors ?? []).map((e) => e.message).join('; ')}`);
  }
  return response.data.search;
}

export class GitHubPullRequestSource implements PullRequestSource {
  async mergedPullRequests(repository: RepositoryRef, range: DateRange): Promise<PullRequestActivity[]> {
    const repo = `${repository.owner}/${repository.name}`;
    const searchQuery = `repo:${repo} is:pr is:merged merged:${range.since}..${range.until}`;
    const found: PullRequestActivity[] = [];
    let cursor: string | null = null;
    do {
      const page: SearchPage = await fetchPage(searchQuery, cursor);
      if (page.issueCount > SEARCH_RESULT_LIMIT) {
        throw new DataError(
          `${repo} has ${page.issueCount} merged pull requests in ${range.since}..${range.until}; GitHub search returns at most ${SEARCH_RESULT_LIMIT}. Narrow the range with --since and --until`,
        );
      }
      found.push(...page.nodes.map(toActivity));
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return found;
  }
}
