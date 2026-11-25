import type { Dashboard, DashboardProgress, RepositoryOption } from '@fluxion/core';
import { countQueryString, queryString, type Query } from './query.js';

const GATEWAY_TIMEOUTS = [502, 504];
const HTTP_ACCEPTED = 202;
const JOB_POLL_MS = 500;
const MAX_FAILED_POLLS_IN_A_ROW = 3;
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

export interface LoadOptions {
  signal?: AbortSignal;
  onProgress?(progress: DashboardProgress): void;
  pollMs?: number;
}

interface RunningJob {
  jobId: string;
  progress: DashboardProgress | null;
}

function pause(milliseconds: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isTransient(response: Response): boolean {
  return GATEWAY_TIMEOUTS.includes(response.status) && !response.headers.get('content-type')?.includes('application/json');
}

async function poll(jobId: string, signal: AbortSignal | undefined, pollMs: number): Promise<Response> {
  for (let failures = 1; ; failures += 1) {
    await pause(pollMs, signal);
    const isLastAttempt = failures === MAX_FAILED_POLLS_IN_A_ROW;
    try {
      const response = await fetch(`/api/pr/jobs/${jobId}`, signal ? { signal } : {});
      if (isLastAttempt || !isTransient(response)) return response;
    } catch (error) {
      if (isLastAttempt || signal?.aborted) throw error;
    }
  }
}

export async function fetchDashboard(query: Query, refresh: boolean, { signal, onProgress, pollMs = JOB_POLL_MS }: LoadOptions = {}): Promise<Dashboard> {
  let response = await fetch(`/api/pr/jobs?${queryString(query, refresh)}`, { method: 'POST', ...(signal ? { signal } : {}) });
  while (response.status === HTTP_ACCEPTED) {
    const job = await bodyOf<RunningJob>(response);
    if (job.progress) onProgress?.(job.progress);
    response = await poll(job.jobId, signal, pollMs);
  }
  return bodyOf<Dashboard>(response);
}

export async function fetchPullRequestCount(query: Query): Promise<number> {
  return (await bodyOf<{ count: number }>(await fetch(`/api/pr/count?${countQueryString(query)}`))).count;
}

export async function fetchRepositories(): Promise<RepositoryOption[]> {
  return (await bodyOf<{ repositories: RepositoryOption[] }>(await fetch('/api/repositories'))).repositories;
}
