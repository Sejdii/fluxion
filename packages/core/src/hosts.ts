import { UsageError } from './errors.js';
import { displayName, type RepositoryFinder, type RepositoryRef } from './pull-request-source.js';

function namesByHost(repositories: RepositoryRef[]): Map<string, string[]> {
  const byHost = new Map<string, string[]>();
  repositories.forEach((repository) => byHost.set(repository.host, [...(byHost.get(repository.host) ?? []), displayName(repository)]));
  return byHost;
}

function mixedHosts(byHost: Map<string, string[]>): UsageError {
  const listed = [...byHost].map(([host, names]) => `${host}: ${names.join(', ')}`).join('; ');
  return new UsageError(`Repositories must all be on the same host. ${listed}. Choose one host with --repos`);
}

export async function findOnOneHost(finder: RepositoryFinder): Promise<RepositoryRef[]> {
  const repositories = await finder.find();
  const byHost = namesByHost(repositories);
  if (byHost.size > 1) throw mixedHosts(byHost);
  return repositories;
}
