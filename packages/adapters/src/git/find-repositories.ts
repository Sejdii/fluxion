import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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

function withoutDuplicates(repositories: RepositoryRef[]): RepositoryRef[] {
  return [...new Map(repositories.map((repository) => [repositoryKey(repository), repository])).values()];
}

export async function findRepositories(directory: string, paths?: string[]): Promise<RepositoryRef[]> {
  const directories = await repositoryDirectories(directory, paths);
  return withoutDuplicates(await Promise.all(directories.map(resolveCurrentRepository)));
}
