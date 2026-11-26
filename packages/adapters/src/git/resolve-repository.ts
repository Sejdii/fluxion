import { execFile } from 'node:child_process';
import { DataError, type RepositoryRef } from '@fluxion/core';

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });
}

const SCHEME_URL = /^(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?([^/:\s]+)(?::\d+)?\/(\S+)$/;
const SCP_URL = /^(?:[^@/\s]+@)?([^/:\s]+):(?!\/\/)(\S+)$/;
const REPOSITORY_PATH = /^\/?([^/]+)\/([^/]+?)(?:\.git)?\/?$/;
const PREFERRED_REMOTE = 'origin';
const HOSTNAME_ALIASES = new Map([
  ['ssh.github.com', 'github.com'],
  ['www.github.com', 'github.com'],
]);

interface RemoteAddress {
  host: string;
  path: string;
}

function addressOf(url: string): RemoteAddress | undefined {
  const match = SCHEME_URL.exec(url.trim()) ?? SCP_URL.exec(url.trim());
  if (!match?.[1] || !match[2]) return undefined;
  const hostname = match[1].toLowerCase();
  return { host: HOSTNAME_ALIASES.get(hostname) ?? hostname, path: match[2] };
}

function knownHost(hostname: string | undefined, hosts: string[]): string | undefined {
  return hosts.find((known) => known.toLowerCase() === hostname);
}

export function parseRemote(url: string, hosts: string[]): RepositoryRef | undefined {
  const address = addressOf(url);
  const host = knownHost(address?.host, hosts);
  const [, owner, name] = REPOSITORY_PATH.exec(address?.path ?? '') ?? [];
  return host && owner && name ? { host, owner, name } : undefined;
}

async function remoteUrls(directory: string): Promise<string[]> {
  const output = await git(directory, ['remote', '-v']);
  const remotes = output.split('\n').map((line) => line.split(/\s+/));
  const preferredFirst = [...remotes.filter(([name]) => name === PREFERRED_REMOTE), ...remotes.filter(([name]) => name !== PREFERRED_REMOTE)];
  return preferredFirst.map(([, url]) => url ?? '');
}

export function isInsideRepository(directory: string): Promise<boolean> {
  return git(directory, ['rev-parse', '--is-inside-work-tree']).then(
    () => true,
    () => false,
  );
}

function noGitHubRemote(directory: string, urls: string[], hosts: string[]): DataError {
  const host = urls.map((url) => addressOf(url)?.host).find((found) => found !== undefined && !knownHost(found, hosts));
  const hint = host ? `. gh is not logged in to ${host}; if it is a GitHub host, run \`gh auth login --hostname ${host}\`` : '';
  return new DataError(`${directory} has no GitHub remote${hint}`);
}

export async function resolveCurrentRepository(directory: string, hosts: string[]): Promise<RepositoryRef> {
  const urls = await remoteUrls(directory).catch(() => {
    throw new DataError(`${directory} is not inside a git repository`);
  });
  const repository = urls.map((url) => parseRemote(url, hosts)).find((ref) => ref !== undefined);
  if (!repository) throw noGitHubRemote(directory, urls, hosts);
  return repository;
}
