import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { findRepositories, locateRepositories } from '../src/git/find-repositories.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fluxion-find-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function repository(path: string, remote = `git@github.com:acme/${path.replaceAll('/', '-')}.git`): void {
  const directory = join(root, path);
  mkdirSync(directory, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: directory });
  if (remote) execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: directory });
}

function names(refs: { name: string }[]): string[] {
  return refs.map((ref) => ref.name).sort();
}

test('insideARepositoryUsesThatRepositoryFromASubfolder', async () => {
  repository('app');
  mkdirSync(join(root, 'app', 'src'));

  const result = await findRepositories(join(root, 'app', 'src'));

  expect(names(result)).toEqual(['app']);
});

test('inAFolderScansDownwardForRepositories', async () => {
  repository('one');
  repository('group/two');

  const result = await findRepositories(root);

  expect(names(result)).toEqual(['group-two', 'one']);
});

test('scanStopsAtTheFirstGitFolder', async () => {
  repository('outer');
  repository('outer/inner');

  const result = await findRepositories(root);

  expect(names(result)).toEqual(['outer']);
});

test('scanSkipsHiddenFoldersAndNodeModules', async () => {
  repository('visible');
  repository('.hidden/repo');
  repository('node_modules/pkg');

  const result = await findRepositories(root);

  expect(names(result)).toEqual(['visible']);
});

test('folderWithoutRepositoriesIsADataError', async () => {
  const result = findRepositories(root);

  await expect(result).rejects.toThrow(`No git repositories found in ${root}`);
});

test('reposAreResolvedRelativeToTheFolder', async () => {
  repository('one');
  repository('two');
  repository('three');

  const result = await findRepositories(root, ['one', 'three']);

  expect(names(result)).toEqual(['one', 'three']);
});

test('reposOverrideTheRepositoryTheFolderIsIn', async () => {
  repository('app');
  repository('app/nested');

  const result = await findRepositories(join(root, 'app'), ['nested']);

  expect(names(result)).toEqual(['app-nested']);
});

test('failingRepositoryInReposIsNamed', async () => {
  repository('good');
  repository('bad', '');

  const result = findRepositories(root, ['good', 'bad']);

  await expect(result).rejects.toThrow(`${join(root, 'bad')} has no GitHub remote`);
});

test('failingRepositoryFoundByScanIsNamed', async () => {
  repository('good');
  repository('bad', 'https://gitlab.com/acme/bad.git');

  const result = findRepositories(root);

  await expect(result).rejects.toThrow(`${join(root, 'bad')} has no GitHub remote`);
});

test('missingReposPathIsADataErrorNamingIt', async () => {
  const result = findRepositories(root, ['nope']);

  await expect(result).rejects.toThrow(`${join(root, 'nope')} is not inside a git repository`);
});

test('twoClonesOfTheSameRepositoryArePooledOnce', async () => {
  repository('a', 'git@github.com:acme/app.git');
  repository('b', 'https://github.com/acme/app');

  const result = await findRepositories(root);

  expect(result).toEqual([{ host: 'github', owner: 'acme', name: 'app' }]);
});

test('locatingRepositoriesPairsEachWithItsPathRelativeToTheFolder', async () => {
  repository('one');
  repository('group/two');

  const result = await locateRepositories(root);

  expect(result.map((located) => located.path)).toEqual(['group/two', 'one']);
});

test('locatingInsideARepositoryReturnsTheCurrentFolderPath', async () => {
  repository('app');

  const result = await locateRepositories(join(root, 'app'));

  expect(result.map((located) => located.path)).toEqual(['.']);
});
