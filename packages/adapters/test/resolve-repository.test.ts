import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { DataError } from '@fluxion/core';
import { parseRemote, resolveCurrentRepository } from '../src/git/resolve-repository.js';

const HOSTS = ['github.com', 'github.corp.example'];

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

  const result = await resolveCurrentRepository(workDir, HOSTS);

  expect(result).toEqual({ host: 'github.com', owner: 'acme', name: 'app' });
});

test('directoryOutsideAGitRepositoryIsADataError', async () => {
  const result = resolveCurrentRepository(workDir, HOSTS);

  await expect(result).rejects.toThrow('is not inside a git repository');
});

test('repositoryWithoutAGitHubRemoteIsADataError', async () => {
  git('init', '-q');
  git('remote', 'add', 'origin', 'https://gitlab.com/acme/app.git');

  const result = resolveCurrentRepository(workDir, HOSTS);

  await expect(result).rejects.toThrow(`${workDir} has no GitHub remote`);
});

test('parsesHttpsRemoteWithoutGitSuffix', () => {
  const result = parseRemote('https://github.com/acme/app', HOSTS);

  expect(result).toEqual({ host: 'github.com', owner: 'acme', name: 'app' });
});

test.each([
  'git@github.corp.example:acme/app.git',
  'ssh://git@github.corp.example:2222/acme/app.git',
  'https://ann@GitHub.Corp.Example/acme/app/',
])('parsesARemoteOnAnyKnownHost %s', (url) => {
  const result = parseRemote(url, HOSTS);

  expect(result).toEqual({ host: 'github.corp.example', owner: 'acme', name: 'app' });
});

test.each(['https://notgithub.com/acme/app', '/mirrors/github.com/acme/app', 'https://github.com/acme'])('ignoresARemoteThatIsNotARepositoryOnAKnownHost %s', (url) => {
  const result = parseRemote(url, HOSTS);

  expect(result).toBeUndefined();
});

test('originWinsOverARemoteThatSortsBeforeIt', async () => {
  git('init', '-q');
  git('remote', 'add', 'backup', 'git@github.com:acme/mirror.git');
  git('remote', 'add', 'origin', 'git@github.corp.example:acme/app.git');

  const result = await resolveCurrentRepository(workDir, HOSTS);

  expect(result).toEqual({ host: 'github.corp.example', owner: 'acme', name: 'app' });
});

test('anotherRemoteIsUsedWhenOriginIsNotOnAKnownHost', async () => {
  git('init', '-q');
  git('remote', 'add', 'origin', 'https://gitlab.com/acme/app.git');
  git('remote', 'add', 'upstream', 'git@github.com:acme/app.git');

  const result = await resolveCurrentRepository(workDir, HOSTS);

  expect(result).toEqual({ host: 'github.com', owner: 'acme', name: 'app' });
});

test('unknownHostErrorSuggestsLoggingInToIt', async () => {
  git('init', '-q');
  git('remote', 'add', 'origin', 'git@ghe.other.example:acme/app.git');

  const result = resolveCurrentRepository(workDir, HOSTS);

  await expect(result).rejects.toThrow(
    `${workDir} has no GitHub remote. gh is not logged in to ghe.other.example; if it is a GitHub host, run \`gh auth login --hostname ghe.other.example\``,
  );
});

test('malformedRemoteOnAKnownHostDoesNotSuggestLoggingIn', async () => {
  git('init', '-q');
  git('remote', 'add', 'origin', 'https://github.com/acme');

  const result = resolveCurrentRepository(workDir, HOSTS);

  await expect(result).rejects.toThrow(new DataError(`${workDir} has no GitHub remote`));
  await expect(result).rejects.not.toThrow('logged in');
});
