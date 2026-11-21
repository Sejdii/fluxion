import { execFile } from 'node:child_process';
import { DataError } from '@fluxion/core';

const MAX_BUFFER = 64 * 1024 * 1024;

/** Runs `gh` with the arguments and returns stdout. Any failure is a DataError. */
export function runGh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      if ('code' in error && error.code === 'ENOENT') {
        return reject(new DataError('The gh CLI was not found. Install it from https://cli.github.com and run `gh auth login`'));
      }
      reject(new DataError(`gh failed: ${stderr.trim() || error.message}`));
    });
  });
}
