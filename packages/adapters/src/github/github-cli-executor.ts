import { execFile } from 'node:child_process';
import { DataError } from '@fluxion/core';
import type { GithubApi, GraphqlVariables } from './github-api.js';

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

interface GraphqlResponse {
  data?: unknown;
  errors?: { message: string }[];
}

function runGh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: MAX_OUTPUT_BYTES }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      if ('code' in error && error.code === 'ENOENT') {
        return reject(new DataError('The gh CLI was not found. Install it from https://cli.github.com and run `gh auth login`'));
      }
      const message = stderr.trim() || error.message;
      const notLoggedIn = /gh auth login/.test(message);
      reject(new DataError(notLoggedIn ? 'gh is not logged in. Run `gh auth login`' : `gh failed: ${message}`));
    });
  });
}

function parseResponse(output: string): GraphqlResponse {
  try {
    return JSON.parse(output) as GraphqlResponse;
  } catch {
    throw new DataError('gh returned a response that is not valid JSON');
  }
}

function toArguments(document: string, variables: GraphqlVariables): string[] {
  const fields = Object.entries(variables).flatMap(([name, value]) => ['-f', `${name}=${value}`]);
  return ['api', 'graphql', '-f', `query=${document}`, ...fields];
}

export class GithubCliExecutor implements GithubApi {
  async executeApi(document: string, variables: GraphqlVariables): Promise<unknown> {
    const response = parseResponse(await runGh(toArguments(document, variables)));
    if (response.data === undefined) {
      const messages = (response.errors ?? []).map((error) => error.message).join('; ');
      throw new DataError(`GitHub returned errors: ${messages}`);
    }
    return response.data;
  }
}
