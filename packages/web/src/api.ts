import type { Dashboard } from '@fluxion/core';

const DEFAULT_PERIOD = 'monthly';

export async function fetchDashboard(): Promise<Dashboard> {
  const response = await fetch(`/api/pr?period=${DEFAULT_PERIOD}`);
  const body = (await response.json()) as Dashboard | { error: string };
  if ('error' in body) throw new Error(body.error);
  return body;
}
