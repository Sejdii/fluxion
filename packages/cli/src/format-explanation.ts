import type { Explanation, FirstResponse } from '@fluxion/core';

const NOT_MERGED_NO_VALUES = 'not merged, no values';

function firstResponseText(response: FirstResponse | null): string {
  if (response === null) return 'none yet';
  return response.kind === 'human' ? `${response.at} by ${response.by ?? '(deleted account)'}` : `${response.at} (the merge)`;
}

function reviewersText(reviewers: string[]): string {
  return reviewers.length === 0 ? '0' : `${reviewers.length} (${reviewers.join(', ')})`;
}

function aligned(rows: [string, string][]): string[] {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`);
}

function valueLines(explanation: Explanation): string[] {
  if (explanation.values === null) return [NOT_MERGED_NO_VALUES];
  const rows = explanation.values.map((entry): [string, string] => [entry.metric, entry.unit ? `${entry.value} ${entry.unit}` : String(entry.value)]);
  return ['values', ...aligned(rows)];
}

export function formatExplanation(explanation: Explanation): string {
  const { facts } = explanation;
  const factRows: [string, string][] = [
    ['ready for review', facts.readyForReviewAt],
    ['first response', firstResponseText(facts.firstResponse)],
    ['merged', facts.mergedAt ?? 'not merged'],
    ['comments counted', String(facts.comments)],
    ['reviewers counted', reviewersText(facts.reviewers)],
  ];
  const heading = `pull request #${explanation.number} (${explanation.merged ? 'merged' : 'not merged'})`;
  return [heading, '', 'facts', ...aligned(factRows), '', ...valueLines(explanation), ''].join('\n');
}

export function formatExplanationJson(explanation: Explanation): string {
  return `${JSON.stringify(explanation, null, 2)}\n`;
}
