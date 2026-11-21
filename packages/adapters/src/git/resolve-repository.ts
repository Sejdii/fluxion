import { execFile } from 'node:child_process';
import { DataError, type RepositoryRef } from '@fluxion/core';

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });
}

const GITHUB_URL = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/;

export function parseGitHubRemote(url: string): RepositoryRef | undefined {
  const match = GITHUB_URL.exec(url.trim());
  return match?.[1] && match[2] ? { host: 'github', owner: match[1], name: match[2] } : undefined;
}

async function remoteUrls(directory: string): Promise<string[]> {
  const output = await git(directory, ['remote', '-v']);
  return output.split('\n').map((line) => line.split(/\s+/)[1] ?? '');
}

export async function resolveCurrentRepository(directory: string): Promise<RepositoryRef> {
  const urls = await remoteUrls(directory).catch(() => {
    throw new DataError(`${directory} is not inside a git repository`);
  });
  const repository = urls.map(parseGitHubRemote).find((ref) => ref !== undefined);
  if (!repository) throw new DataError('The git repository has no GitHub remote');
  return repository;
}
