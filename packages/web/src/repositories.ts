import type { RepositoryOption } from '@fluxion/core';

const PREFERRED_HOST = 'github.com';

export interface HostGroup {
  host: string;
  options: RepositoryOption[];
}

function byPreference(first: string, second: string): number {
  return Number(second === PREFERRED_HOST) - Number(first === PREFERRED_HOST) || first.localeCompare(second);
}

export function groupByHost(options: RepositoryOption[]): HostGroup[] {
  const hosts = [...new Set(options.map((option) => option.host))].sort(byPreference);
  return hosts.map((host) => ({ host, options: options.filter((option) => option.host === host) }));
}

export function preselectedRepositories(options: RepositoryOption[]): string[] {
  const [largest] = groupByHost(options).sort((first, second) => second.options.length - first.options.length);
  return (largest?.options ?? []).map((option) => option.path);
}

export function toggledRepositories(options: RepositoryOption[], selected: string[], path: string): string[] {
  if (selected.includes(path)) return selected.filter((repo) => repo !== path);
  const hostOf = (repo: string) => options.find((option) => option.path === repo)?.host;
  return [...selected.filter((repo) => hostOf(repo) === hostOf(path)), path];
}
