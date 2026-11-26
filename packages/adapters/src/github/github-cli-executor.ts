import { execFile } from 'node:child_process';
import { DataError } from '@fluxion/core';
import type { GithubApi, GraphqlVariables } from './github-api.js';

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

interface GraphqlResponse {
  data?: unknown;
  errors?: { message: string }[];
}

function loginCommand(host: string | undefined): string {
  return host ? `gh auth login --hostname ${host}` : 'gh auth login';
}

function failureOf(message: string, host: string | undefined): DataError {
  if (/unknown flag: --json/.test(message)) return new DataError('This gh CLI is too old to list its hosts. Upgrade gh');
  if (!/gh auth login/.test(message)) return new DataError(`gh failed: ${message}`);
  return new DataError(`gh is not logged in${host ? ` to ${host}` : ''}. Run \`${loginCommand(host)}\``);
}

function runGh(args: string[], host?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: MAX_OUTPUT_BYTES }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      if ('code' in error && error.code === 'ENOENT') {
        return reject(new DataError('The gh CLI was not found. Install it from https://cli.github.com and run `gh auth login`'));
      }
      reject(failureOf(stderr.trim() || error.message, host));
    });
  });
}

function parseResponse<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new DataError('gh returned a response that is not valid JSON');
  }
}

function toArguments(host: string, document: string, variables: GraphqlVariables): string[] {
  const fields = Object.entries(variables).flatMap(([name, value]) => [typeof value === 'number' ? '-F' : '-f', `${name}=${value}`]);
  return ['api', 'graphql', '--hostname', host, '-f', `query=${document}`, ...fields];
}

type HostAccounts = Record<string, { state: string; login: string }[]>;

export function hostsWithALogin(accountsByHost: HostAccounts): string[] {
  const hosts = Object.entries(accountsByHost)
    .filter(([, accounts]) => accounts.some((account) => account.state === 'success' || account.login !== ''))
    .map(([host]) => host);
  if (hosts.length === 0) throw new DataError(`gh is not logged in. Run \`${loginCommand(undefined)}\``);
  return hosts;
}

export async function loggedInHosts(): Promise<string[]> {
  const status = parseResponse<{ hosts: HostAccounts }>(await runGh(['auth', 'status', '--json', 'hosts']));
  return hostsWithALogin(status.hosts);
}

export class GithubCliExecutor implements GithubApi {
  async executeApi(host: string, document: string, variables: GraphqlVariables): Promise<unknown> {
    const response = parseResponse<GraphqlResponse>(await runGh(toArguments(host, document, variables), host));
    if (response.data === undefined) {
      const messages = (response.errors ?? []).map((error) => error.message).join('; ');
      throw new DataError(`GitHub returned errors: ${messages}`);
    }
    return response.data;
  }
}
