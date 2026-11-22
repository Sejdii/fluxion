import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { DataError, repositoryKey, type RepositoryRef } from '@fluxion/core';
import { isInsideRepository, resolveCurrentRepository } from './resolve-repository.js';

const SKIPPED_FOLDERS = new Set(['node_modules']);

function isScanned(name: string): boolean {
  return !name.startsWith('.') && !SKIPPED_FOLDERS.has(name);
}

async function scanDownward(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.name === '.git')) return [directory];
  const subfolders = entries.filter((entry) => entry.isDirectory() && isScanned(entry.name));
  const found = await Promise.all(subfolders.map((entry) => scanDownward(join(directory, entry.name))));
  return found.flat().sort();
}

async function repositoryDirectories(directory: string, paths: string[] | undefined): Promise<string[]> {
  if (paths && paths.length > 0) return paths.map((path) => resolve(directory, path));
  if (await isInsideRepository(directory)) return [directory];
  const found = await scanDownward(directory);
  if (found.length === 0) throw new DataError(`No git repositories found in ${directory}`);
  return found;
}

export interface LocatedRepository {
  path: string;
  repository: RepositoryRef;
}

function withoutDuplicates(located: LocatedRepository[]): LocatedRepository[] {
  return [...new Map(located.map((entry) => [repositoryKey(entry.repository), entry])).values()];
}

export async function locateRepositories(directory: string, paths?: string[]): Promise<LocatedRepository[]> {
  const directories = await repositoryDirectories(directory, paths);
  const located = await Promise.all(
    directories.map(async (found) => ({ path: relative(directory, found) || '.', repository: await resolveCurrentRepository(found) })),
  );
  return withoutDuplicates(located);
}

export async function findRepositories(directory: string, paths?: string[]): Promise<RepositoryRef[]> {
  return (await locateRepositories(directory, paths)).map((entry) => entry.repository);
}
