import type { Explanation, MetricValue, FirstResponse, WorkSchedule } from '@fluxion/core';

const NOT_MERGED_NO_VALUES = 'not merged, no values';

function firstResponseText(response: FirstResponse | null): string {
  if (response === null) return 'none yet';
  return response.kind === 'human' ? `${response.at} by ${response.by}` : `${response.at} (the merge)`;
}

function reviewersText(reviewers: string[]): string {
  return reviewers.length === 0 ? '0' : `${reviewers.length} (${reviewers.join(', ')})`;
}

function aligned(rows: [string, string][]): string[] {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`);
}

const WORKING_TIME_LABEL = '(working time)';
const WORKING_TIME_METRICS = ['reviewWaitingTime', 'totalReviewTime'];

function valueText(entry: MetricValue, schedule: WorkSchedule | undefined): string {
  if (!entry.unit) return String(entry.value);
  const label = schedule && WORKING_TIME_METRICS.includes(entry.metric) ? ` ${WORKING_TIME_LABEL}` : '';
  return `${entry.value} ${entry.unit}${label}`;
}

function scheduleText(schedule: WorkSchedule): string {
  return `${schedule.days.join(',')} ${schedule.start}-${schedule.end} ${schedule.timeZone}`;
}

function valueLines(explanation: Explanation): string[] {
  if (explanation.values === null) return [NOT_MERGED_NO_VALUES];
  const rows = explanation.values.map((entry): [string, string] => [entry.metric, valueText(entry, explanation.workSchedule)]);
  return ['values', ...aligned(rows)];
}

export function formatExplanation(explanation: Explanation): string {
  const { facts } = explanation;
  const factRows: [string, string][] = [
    ['ready for review', facts.readyForReviewAt],
    ['first response', firstResponseText(facts.firstResponse)],
    ...(facts.firstResponseWorkingHours === undefined ? [] : [['first response after', `${facts.firstResponseWorkingHours} h ${WORKING_TIME_LABEL}`] as [string, string]]),
    ['merged', facts.mergedAt ?? 'not merged'],
    ['comments counted', String(facts.comments)],
    ['reviewers counted', reviewersText(facts.reviewers)],
  ];
  const heading = `pull request #${explanation.number} (${facts.mergedAt === null ? 'not merged' : 'merged'})`;
  const schedule = explanation.workSchedule ? [`working time: ${scheduleText(explanation.workSchedule)}`, ''] : [];
  return [heading, '', ...schedule, 'facts', ...aligned(factRows), '', ...valueLines(explanation), ''].join('\n');
}

export function formatExplanationJson(explanation: Explanation): string {
  return `${JSON.stringify(explanation, null, 2)}\n`;
}
