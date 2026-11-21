import { expect, test } from 'vitest';
import { runCli, type ServeRequest } from '../src/program.js';

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
  served: ServeRequest[];
}

async function run(args: string[]): Promise<Outcome> {
  const outcome: Outcome = { code: -1, stdout: '', stderr: '', served: [] };
  const runners = {
    metric: () => Promise.reject(new Error('not used')),
    explain: () => Promise.reject(new Error('not used')),
    serve: (request: ServeRequest) => {
      outcome.served.push(request);
      return Promise.resolve('http://127.0.0.1:4567');
    },
  };
  outcome.code = await runCli(args, runners, {
    stdout: (text) => (outcome.stdout += text),
    stderr: (text) => (outcome.stderr += text),
  });
  return outcome;
}

test('plainFluxionStartsTheDashboardAndPrintsItsUrl', async () => {
  const outcome = await run([]);

  expect(outcome).toMatchObject({ code: 0, stdout: 'Fluxion dashboard: http://127.0.0.1:4567\n', served: [{ open: true }] });
});

test('portFlagPinsTheDashboardPort', async () => {
  const outcome = await run(['--port', '4000']);

  expect(outcome.served).toEqual([{ open: true, port: 4000 }]);
});

test('noOpenFlagSkipsLaunchingTheBrowser', async () => {
  const outcome = await run(['--no-open']);

  expect(outcome.served).toEqual([{ open: false }]);
});

test('reposFlagSelectsTheDashboardRepositories', async () => {
  const outcome = await run(['--repos', 'a,b', 'c']);

  expect(outcome.served).toEqual([{ open: true, repos: ['a', 'b', 'c'] }]);
});

test('invalidPortExitsWith1', async () => {
  const outcome = await run(['--port', '70000']);

  expect(outcome).toMatchObject({ code: 1, stderr: 'error: Invalid port "70000". Use a number from 0 to 65535\n', served: [] });
});

test('nonNumericPortExitsWith1', async () => {
  const outcome = await run(['--port', 'abc']);

  expect(outcome.code).toBe(1);
});
