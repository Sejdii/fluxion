import type { Dashboard, RepositoryOption } from '@fluxion/core';
import { countQueryString, queryString, type Query } from './query.js';

const GATEWAY_TIMEOUTS = [502, 504];
const LARGE_REPOSITORY_HINT = 'The repository is probably large and the request timed out. Try a shorter time range.';

function failure(response: Response): Error {
  return new Error(GATEWAY_TIMEOUTS.includes(response.status) ? `${LARGE_REPOSITORY_HINT} (HTTP ${response.status})` : `Request failed with HTTP ${response.status}`);
}

async function bodyOf<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => undefined)) as T | { error: string } | undefined;
  if (body === undefined) throw failure(response);
  if (typeof body === 'object' && body !== null && 'error' in body) throw new Error(String(body.error));
  if (!response.ok) throw failure(response);
  return body as T;
}

export async function fetchDashboard(query: Query, refresh: boolean): Promise<Dashboard> {
  return bodyOf<Dashboard>(await fetch(`/api/pr?${queryString(query, refresh)}`));
}

export async function fetchPullRequestCount(query: Query): Promise<number> {
  return (await bodyOf<{ count: number }>(await fetch(`/api/pr/count?${countQueryString(query)}`))).count;
}

export async function fetchRepositories(): Promise<RepositoryOption[]> {
  return (await bodyOf<{ repositories: RepositoryOption[] }>(await fetch('/api/repositories'))).repositories;
}
