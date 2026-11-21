import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { parseGitHubRemote, resolveCurrentRepository } from './resolve-repository.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'fluxion-git-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function git(...args: string[]): void {
  execFileSync('git', args, { cwd: workDir });
}

test('resolvesTheGitHubRemoteOfTheRepository', async () => {
  git('init', '-q');
  git('remote', 'add', 'origin', 'git@github.com:acme/app.git');

  const result = await resolveCurrentRepository(workDir);

  expect(result).toEqual({ host: 'github', owner: 'acme', name: 'app' });
});

test('directoryOutsideAGitRepositoryIsADataError', async () => {
  const result = resolveCurrentRepository(workDir);

  await expect(result).rejects.toThrow('is not inside a git repository');
});

test('repositoryWithoutAGitHubRemoteIsADataError', async () => {
  git('init', '-q');
  git('remote', 'add', 'origin', 'https://gitlab.com/acme/app.git');

  const result = resolveCurrentRepository(workDir);

  await expect(result).rejects.toThrow('The git repository has no GitHub remote');
});

test('parsesHttpsRemoteWithoutGitSuffix', () => {
  const result = parseGitHubRemote('https://github.com/acme/app');

  expect(result).toEqual({ host: 'github', owner: 'acme', name: 'app' });
});
