import { expect, test } from 'vitest';
import { DataError, UsageError, type MetricRequest, type MetricResult } from '@fluxion/core';
import { runCli, type RunMetric } from '../src/program.js';

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
  requests: MetricRequest[];
}

const result: MetricResult = {
  range: { since: '2026-01-01', until: '2026-02-28' },
  rows: [
    { period: '2026-01', n: 12, value: 12 },
    { period: '2026-02', n: 0, value: null },
  ],
};

async function run(args: string[], useCase: RunMetric = () => Promise.resolve(result)): Promise<Outcome> {
  const outcome: Outcome = { code: -1, stdout: '', stderr: '', requests: [] };
  const recording: RunMetric = (request) => {
    outcome.requests.push(request);
    return useCase(request);
  };
  outcome.code = await runCli(args, recording, {
    stdout: (text) => (outcome.stdout += text),
    stderr: (text) => (outcome.stderr += text),
  });
  return outcome;
}

test('printsTheTableOnStdoutWithExitCode0', async () => {
  const outcome = await run(['pr', 'prsMerged', 'total', 'monthly']);

  expect(outcome).toMatchObject({
    code: 0,
    stderr: '',
    stdout: 'period   prsMerged  n\n2026-01  12         12\n2026-02  -          0\n',
  });
});

test('flagsALowSampleMedianInTheTable', async () => {
  const lowSample = { range: result.range, unit: 'hours', rows: [{ period: '2026-01', n: 3, value: 4.5, lowSample: true as const }] };

  const outcome = await run(['pr', 'reviewWaitingTime', 'median', 'monthly'], () => Promise.resolve(lowSample));

  expect(outcome.stdout).toBe('period   reviewWaitingTime (hours)  n\n2026-01  4.5 (low n)                3\n');
});

test('passesTheGrammarAndRangeToTheUseCase', async () => {
  const outcome = await run(['pr', 'prsMerged', 'total', 'monthly', '--since', '2026-01-01', '--until', '2026-02-28']);

  expect(outcome.requests).toEqual([
    { family: 'pr', metric: 'prsMerged', statistic: 'total', period: 'monthly', since: '2026-01-01', until: '2026-02-28' },
  ]);
});

test('rootHelpListsMetricsAndAllowedStatisticsFromTheRegistry', async () => {
  const outcome = await run(['--help']);

  expect(outcome.stdout).toContain('prsMerged      Pull requests merged per period (statistics: total)');
});

test('familyHelpListsMetricsAndAllowedStatisticsFromTheRegistry', async () => {
  const outcome = await run(['pr', '--help']);

  expect(outcome.stdout).toContain('prsMerged      Pull requests merged per period (statistics: total)');
});

test('helpExitsWith0', async () => {
  const outcome = await run(['pr', '--help']);

  expect(outcome.code).toBe(0);
});

test('missingArgumentsExitWith1AndMessageOnStderr', async () => {
  const outcome = await run(['pr', 'prsMerged']);

  expect(outcome).toMatchObject({ code: 1, stdout: '', stderr: "error: missing required argument 'statistic'\n" });
});

test('usageErrorFromTheUseCaseExitsWith1', async () => {
  const outcome = await run(['pr', 'nope', 'total', 'monthly'], () => Promise.reject(new UsageError('Unknown metric "nope"')));

  expect(outcome).toMatchObject({ code: 1, stdout: '', stderr: 'error: Unknown metric "nope"\n' });
});

test('dataErrorFromTheUseCaseExitsWith2', async () => {
  const outcome = await run(['pr', 'prsMerged', 'total', 'monthly'], () => Promise.reject(new DataError('The git repository has no GitHub remote')));

  expect(outcome).toMatchObject({ code: 2, stdout: '', stderr: 'error: The git repository has no GitHub remote\n' });
});

test('unexpectedErrorsAreNotSwallowed', async () => {
  const outcome = run(['pr', 'prsMerged', 'total', 'monthly'], () => Promise.reject(new TypeError('bug')));

  await expect(outcome).rejects.toThrow('bug');
});
