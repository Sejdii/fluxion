import { DataError } from '@fluxion/core';
import { expect, test } from 'vitest';
import { hostsWithALogin } from '../src/github/github-cli-executor.js';

test('onlyHostsWithALoginCount', () => {
  const result = hostsWithALogin({
    'github.com': [{ state: 'success', login: 'ann' }],
    'expired.corp.example': [{ state: 'error', login: 'ann' }],
    'only-gh-host.corp.example': [{ state: 'error', login: '' }],
  });

  expect(result).toEqual(['github.com', 'expired.corp.example']);
});

test('noLoginAtAllIsADataError', () => {
  expect(() => hostsWithALogin({})).toThrow(new DataError('gh is not logged in. Run `gh auth login`'));
});
