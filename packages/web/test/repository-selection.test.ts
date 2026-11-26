import { expect, test } from 'vitest';
import { preselectedRepositories, toggledRepositories } from '../src/repositories.js';

const app = { path: 'app', name: 'acme/app', host: 'github.com' };
const api = { path: 'api', name: 'acme/api', host: 'github.com' };
const internal = { path: 'internal', name: 'corp/internal', host: 'github.corp.example' };
const tools = { path: 'tools', name: 'corp/tools', host: 'github.corp.example' };
const lab = { path: 'lab', name: 'lab/lab', host: 'alpha.ghe.com' };

test('preselectsTheHostWithTheMostRepositories', () => {
  expect(preselectedRepositories([app, internal, tools])).toEqual(['internal', 'tools']);
});

test('preselectsGitHubDotComWhenHostsTie', () => {
  expect(preselectedRepositories([lab, app])).toEqual(['app']);
});

test('preselectsTheFirstHostAlphabeticallyWhenOtherHostsTie', () => {
  expect(preselectedRepositories([internal, lab])).toEqual(['lab']);
});

test('choosingARepositoryOnAnotherHostSwitchesTheSelectionToIt', () => {
  expect(toggledRepositories([app, api, internal], ['app', 'api'], 'internal')).toEqual(['internal']);
});

test('choosingARepositoryOnTheSameHostAddsIt', () => {
  expect(toggledRepositories([app, api, internal], ['app'], 'api')).toEqual(['app', 'api']);
});

test('choosingASelectedRepositoryRemovesIt', () => {
  expect(toggledRepositories([app, api], ['app', 'api'], 'app')).toEqual(['api']);
});
