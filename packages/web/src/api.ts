import type { Dashboard, RepositoryOption } from '@fluxion/core';
import { queryString, type Query } from './query.js';

async function bodyOf<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | { error: string };
  if (typeof body === 'object' && body !== null && 'error' in body) throw new Error(String(body.error));
  return body as T;
}

export async function fetchDashboard(query: Query, refresh: boolean): Promise<Dashboard> {
  return bodyOf<Dashboard>(await fetch(`/api/pr?${queryString(query, refresh)}`));
}

export async function fetchRepositories(): Promise<RepositoryOption[]> {
  return (await bodyOf<{ repositories: RepositoryOption[] }>(await fetch('/api/repositories'))).repositories;
}
