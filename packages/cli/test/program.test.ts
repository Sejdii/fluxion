import { expect, test } from 'vitest';
import { DataError, UsageError, type Explanation, type MetricRequest, type MetricResult } from '@fluxion/core';
import { runCli, type ExplainRequest, type RunExplain, type RunMetric } from '../src/program.js';

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
  requests: MetricRequest[];
  explained: ExplainRequest[];
}

const result: MetricResult = {
  range: { since: '2026-01-01', until: '2026-02-28' },
  rows: [
    { period: '2026-01', n: 12, value: 12 },
    { period: '2026-02', n: 0, value: null },
  ],
};

const mergedExplanation: Explanation = {
  number: 7,
  merged: true,
  facts: {
    readyForReviewAt: '2026-01-05T08:00:00Z',
    firstResponse: { kind: 'human', by: 'bob', at: '2026-01-05T10:00:00Z' },
    mergedAt: '2026-01-05T18:00:00Z',
    comments: 3,
    reviewers: ['bob', 'cy'],
  },
  values: [
    { metric: 'reviewWaitingTime', unit: 'hours', value: 2 },
    { metric: 'comments', value: 3 },
  ],
};

const unmergedExplanation: Explanation = {
  number: 8,
  merged: false,
  facts: { readyForReviewAt: '2026-01-05T08:00:00Z', firstResponse: null, mergedAt: null, comments: 0, reviewers: [] },
  values: null,
};

async function run(
  args: string[],
  useCase: RunMetric = () => Promise.resolve(result),
  explainCase: RunExplain = () => Promise.resolve(mergedExplanation),
): Promise<Outcome> {
  const outcome: Outcome = { code: -1, stdout: '', stderr: '', requests: [], explained: [] };
  const recording: RunMetric = (request) => {
    outcome.requests.push(request);
    return useCase(request);
  };
  const explaining: RunExplain = (request) => {
    outcome.explained.push(request);
    return explainCase(request);
  };
  outcome.code = await runCli(args, { metric: recording, explain: explaining }, {
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

test('jsonFlagPrintsTheSameRowsAsJsonOnStdout', async () => {
  const outcome = await run(['pr', 'prsMerged', 'total', 'monthly', '--json']);

  expect(JSON.parse(outcome.stdout)).toEqual({
    metric: 'prsMerged',
    statistic: 'total',
    period: 'monthly',
    range: result.range,
    rows: result.rows,
  });
});

test('jsonIncludesTheUnitAndFlagsOfRows', async () => {
  const flagged = { range: result.range, unit: 'hours', rows: [{ period: '2026-03', n: 3, value: 4.5, lowSample: true as const, inProgress: true as const }] };

  const outcome = await run(['pr', 'reviewWaitingTime', 'median', 'monthly', '--json'], () => Promise.resolve(flagged));

  expect(JSON.parse(outcome.stdout)).toMatchObject({ unit: 'hours', rows: flagged.rows });
});

test('outputIsATableUnlessJsonIsRequested', async () => {
  const outcome = await run(['pr', 'prsMerged', 'total', 'monthly']);

  expect(outcome.stdout).toBe('period   prsMerged  n\n2026-01  12         12\n2026-02  -          0\n');
});

test('marksTheUnfinishedPeriodInTheTable', async () => {
  const unfinished = { range: result.range, rows: [{ period: '2026-03', n: 2, value: 2, inProgress: true as const }] };

  const outcome = await run(['pr', 'prsMerged', 'total', 'monthly'], () => Promise.resolve(unfinished));

  expect(outcome.stdout).toBe('period                 prsMerged  n\n2026-03 (in progress)  2          2\n');
});

test('explainPrintsTheFactsAndValuesOfAMergedPullRequest', async () => {
  const outcome = await run(['pr', 'explain', '7']);

  expect(outcome).toMatchObject({
    code: 0,
    stderr: '',
    explained: [{ number: 7 }],
    stdout: [
      'pull request #7 (merged)',
      '',
      'facts',
      '  ready for review   2026-01-05T08:00:00Z',
      '  first response     2026-01-05T10:00:00Z by bob',
      '  merged             2026-01-05T18:00:00Z',
      '  comments counted   3',
      '  reviewers counted  2 (bob, cy)',
      '',
      'values',
      '  reviewWaitingTime  2 hours',
      '  comments           3',
      '',
    ].join('\n'),
  });
});

test('explainPrintsNotMergedNoValuesForAnUnmergedPullRequest', async () => {
  const outcome = await run(['pr', 'explain', '8'], undefined, () => Promise.resolve(unmergedExplanation));

  expect(outcome.stdout).toBe(
    [
      'pull request #8 (not merged)',
      '',
      'facts',
      '  ready for review   2026-01-05T08:00:00Z',
      '  first response     none yet',
      '  merged             not merged',
      '  comments counted   0',
      '  reviewers counted  0',
      '',
      'not merged, no values',
      '',
    ].join('\n'),
  );
});

test('explainWithJsonPrintsTheExplanation', async () => {
  const outcome = await run(['pr', 'explain', '7', '--json']);

  expect(JSON.parse(outcome.stdout)).toEqual(mergedExplanation);
});

test('explainWithSeveralRepositoriesIsAUsageError', async () => {
  const outcome = await run(['pr', 'explain', '7', '--repos', 'api,web']);

  expect(outcome).toMatchObject({
    code: 1,
    stdout: '',
    explained: [],
    stderr: 'error: explain works on exactly one repository, got 2: api, web\n',
  });
});

test('explainWithOneRepositoryPassesItToTheUseCase', async () => {
  const outcome = await run(['pr', 'explain', '7', '--repos', 'api']);

  expect(outcome.explained).toEqual([{ number: 7, repository: 'api' }]);
});

test('explainRejectsANumberThatIsNotAPositiveInteger', async () => {
  const outcome = await run(['pr', 'explain', 'abc']);

  expect(outcome).toMatchObject({ code: 1, stdout: '', stderr: 'error: Invalid pull request number "abc"\n' });
});

test('explainDataErrorExitsWith2', async () => {
  const outcome = await run(['pr', 'explain', '7'], undefined, () => Promise.reject(new DataError('Pull request #7 was not found in acme/app')));

  expect(outcome).toMatchObject({ code: 2, stderr: 'error: Pull request #7 was not found in acme/app\n' });
});

test('explainNamesADeletedAccountAsTheFirstResponder', async () => {
  const deleted: Explanation = { ...mergedExplanation, facts: { ...mergedExplanation.facts, firstResponse: { kind: 'human', by: null, at: '2026-01-05T10:00:00Z' } } };

  const outcome = await run(['pr', 'explain', '7'], undefined, () => Promise.resolve(deleted));

  expect(outcome.stdout).toContain('first response     2026-01-05T10:00:00Z by (deleted account)');
});

test('explainNamesTheMergeAsTheFirstResponseWhenNobodyResponded', async () => {
  const merge: Explanation = { ...mergedExplanation, facts: { ...mergedExplanation.facts, firstResponse: { kind: 'merge', at: '2026-01-05T18:00:00Z' } } };

  const outcome = await run(['pr', 'explain', '7'], undefined, () => Promise.resolve(merge));

  expect(outcome.stdout).toContain('first response     2026-01-05T18:00:00Z (the merge)');
});
