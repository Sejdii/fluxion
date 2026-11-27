import type { ComparisonSkip, DashboardMetric, DashboardSummary, DateRange } from '@fluxion/core';
import { formatValue } from './format.js';
import { preferenceOf, type Preference } from './metrics.js';

const PERCENT = 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type Statistic = 'median' | 'p90' | 'total' | 'n';
export type Tone = 'good' | 'bad' | 'neutral';

export interface ChangeContext {
  metric: DashboardMetric;
  previousRange: DateRange;
  lowSampleThreshold: number;
}

export type Change =
  | { available: true; percent: number; arrow: '▲' | '▼' | '●'; tone: Tone; text: string; sentence: string; short: string }
  | { available: false; reason: string; sentence: string };

const STATISTIC_LABELS: Record<Statistic, string> = { median: 'Median', p90: 'p90', total: 'Total', n: 'Merged PRs' };

function skipReasonOf(skip: ComparisonSkip): string {
  switch (skip.skipped) {
    case 'turnedOff':
      return 'the comparison is turned off in Settings';
    case 'largeLoad':
      return `the selected range has more than ${skip.threshold.toLocaleString('en-US')} merged PRs; set Compare with previous range to Always to compare anyway`;
    case 'countUnavailable':
      return 'the merged PR count could not be checked; press Refresh to try again, or set Compare with previous range to Always';
  }
}

function valueOf(summary: DashboardSummary, statistic: Statistic): number | null {
  return statistic === 'n' ? summary.n : (summary.values[statistic] ?? null);
}

function day(iso: string): string {
  const [, month, date] = iso.split('-');
  return `${Number(date)} ${MONTHS[Number(month) - 1] ?? ''}`;
}

function signed(percent: number): string {
  if (percent > 0) return `+${percent}%`;
  return percent < 0 ? `−${Math.abs(percent)}%` : '0%';
}

function unavailableReason(statistic: Statistic, current: DashboardSummary, previous: DashboardSummary, threshold: number): string | null {
  if (previous.n === 0) return 'the previous range had no merged PRs';
  if (statistic === 'n') return null;
  if (previous.lowSample) return `the previous range had fewer than ${threshold} merged PRs`;
  if (current.lowSample) return `the selected range has fewer than ${threshold} merged PRs`;
  if (valueOf(current, statistic) === null) return 'the selected range has no value';
  if (!valueOf(previous, statistic)) return 'the previous value is zero';
  return null;
}

function toneOf(percent: number, preference: Preference): Tone {
  if (percent === 0 || preference === 'neutral') return 'neutral';
  return (percent > 0) === (preference === 'higher') ? 'good' : 'bad';
}

function unavailable(reason: string): Change {
  return { available: false, reason, sentence: `No comparison: ${reason}.` };
}

export function changeOf(statistic: Statistic, context: ChangeContext): Change {
  const { metric, previousRange, lowSampleThreshold } = context;
  const { current, previous } = metric.tiles;
  if ('skipped' in previous) return unavailable(skipReasonOf(previous));
  const reason = unavailableReason(statistic, current, previous, lowSampleThreshold);
  if (reason !== null) return unavailable(reason);
  const now = valueOf(current, statistic) as number;
  const before = valueOf(previous, statistic) as number;
  const percent = Math.round(((now - before) / before) * PERCENT);
  const format = (value: number): string => (statistic === 'n' ? value.toLocaleString('en-US') : formatValue(metric.unit, value));
  const dates = `${day(previousRange.since)} – ${day(previousRange.until)}`;
  const sentence = `${STATISTIC_LABELS[statistic]} ${format(now)} vs ${format(before)} in the previous range (${dates}). Change: ${signed(percent)}.`;
  const arrow = percent === 0 ? '●' : percent > 0 ? '▲' : '▼';
  const preference = statistic === 'n' && metric.id !== 'prsMerged' ? 'neutral' : preferenceOf(metric);
  const direction = percent === 0 ? 'unchanged' : `${percent > 0 ? 'up' : 'down'} ${Math.abs(percent)}%`;
  return { available: true, percent, arrow, tone: toneOf(percent, preference), text: `${arrow} ${Math.abs(percent)}%`, sentence, short: `${direction} vs previous range` };
}
