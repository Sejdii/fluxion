import type { DashboardMetric, DashboardSummary } from '@fluxion/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Rail } from '../src/Rail.js';
import { Tiles } from '../src/Tiles.js';

const previousRange = { since: '2026-09-23', until: '2026-10-22' };

function summary(n: number, values: Record<string, number | null>, lowSample = false): DashboardSummary {
  return lowSample ? { n, values, lowSample: true } : { n, values };
}

function perPr(id: string, current: DashboardSummary, previous: DashboardSummary): DashboardMetric {
  return { id, unit: 'hours', rows: [], tiles: { current, previous } };
}

function tiles(metric: DashboardMetric): string {
  return renderToStaticMarkup(<Tiles metric={metric} previousRange={previousRange} lowSampleThreshold={5} />);
}

function rail(metric: DashboardMetric): string {
  return renderToStaticMarkup(<Rail metrics={[metric]} selectedId={metric.id} onSelect={() => undefined} controls={null} loading={false} />);
}

const waiting = perPr('reviewWaitingTime', summary(40, { median: 20, p90: 40 }), summary(50, { median: 40, p90: 47 }));

test('everyPerPrTileShowsItsOwnChange', () => {
  const markup = tiles(waiting);
  expect(markup).toContain('▼ 50%');
  expect(markup).toContain('▼ 20%');
  expect(markup).toContain('▼ 20%');
  expect(markup.match(/class="change /g)).toHaveLength(3);
});

test('theChangeIsFocusableAndLabelledWithTheTooltipSentence', () => {
  const markup = tiles(waiting);
  const sentence = 'Median 20h vs 40h in the previous range (23 Sep – 22 Oct). Change: −50%.';
  expect(markup).toContain(`<button type="button" class="change change-good" aria-label="${sentence}">`);
  expect(markup).toContain(`>${sentence}</span>`);
});

test('countMetricTotalTileShowsChangeAndRisesAreGoodForPrsMerged', () => {
  const merged: DashboardMetric = { id: 'prsMerged', rows: [], tiles: { current: summary(60, { total: 60 }), previous: summary(50, { total: 50 }) } };
  const markup = tiles(merged);
  expect(markup).toContain('change-good');
  expect(markup).toContain('▲ 20%');
  expect(markup).toContain('Total 60 vs 50 in the previous range (23 Sep – 22 Oct). Change: +20%.');
});

test('aRiseInWaitingTimeIsBadAndNeutralMetricsStayNeutral', () => {
  expect(tiles(perPr('reviewWaitingTime', summary(40, { median: 200, p90: 1 }), summary(50, { median: 100, p90: 1 })))).toContain('change-bad');
  const size = tiles(perPr('prSize', summary(40, { median: 200, p90: 300 }), summary(50, { median: 100, p90: 100 })));
  expect(size).toContain('change-neutral');
  expect(size).not.toMatch(/change-(good|bad)/);
  const comments: DashboardMetric = { id: 'comments', rows: [], tiles: { current: summary(60, { total: 90 }), previous: summary(50, { total: 50 }) } };
  expect(tiles(comments)).not.toMatch(/change-(good|bad)/);
});

test('theMergedPrsTileIsNeutralOutsidePrsMerged', () => {
  const markup = tiles(waiting);
  expect(markup).toContain('Merged PRs 40 vs 50');
  expect(markup.match(/change-good/g)).toHaveLength(2);
  expect(markup.match(/change-neutral/g)).toHaveLength(1);
});

test('aChangeThatRoundsToZeroIsNeutral', () => {
  const markup = tiles(perPr('reviewWaitingTime', summary(40, { median: 100.2, p90: 1 }), summary(50, { median: 100, p90: 1 })));
  expect(markup).toContain('● 0%');
  expect(markup).toContain('class="change change-neutral"');
});

test('aMissingChangeShowsADashWithTheReason', () => {
  const lowPrevious = tiles(perPr('reviewWaitingTime', summary(40, { median: 1, p90: 1 }), summary(3, { median: 1, p90: 1 }, true)));
  expect(lowPrevious).toContain('No comparison: the previous range had fewer than 5 merged PRs.');
  expect(lowPrevious).toContain('>—</span>');
  const nonePrevious = tiles(perPr('reviewWaitingTime', summary(40, { median: 1, p90: 1 }), summary(0, { median: null, p90: null })));
  expect(nonePrevious).toContain('No comparison: the previous range had no merged PRs.');
  const lowCurrent = tiles(perPr('reviewWaitingTime', summary(3, { median: 1, p90: 1 }, true), summary(40, { median: 1, p90: 1 })));
  expect(lowCurrent).toContain('No comparison: the selected range has fewer than 5 merged PRs.');
  const zero: DashboardMetric = { id: 'comments', rows: [], tiles: { current: summary(60, { total: 9 }), previous: summary(50, { total: 0 }) } };
  expect(tiles(zero)).toContain('No comparison: the previous value is zero.');
});

test('theP90TileKeepsItsLowSampleNote', () => {
  expect(tiles(perPr('reviewWaitingTime', summary(3, { median: 1, p90: 1 }, true), summary(40, { median: 1, p90: 1 })))).toContain('<span class="muted">low sample</span>');
});

test('theRailRowShowsACompactColouredChangeAndShortLabel', () => {
  const markup = rail(waiting);
  expect(markup).toContain('<span class="muted change-good">▼ 50%</span>');
  expect(markup).toContain('aria-label="Review waiting time, 20h, down 50% vs previous range"');
});

test('theRailShowsNothingForAnUnavailablePreviousButKeepsCurrentLowSample', () => {
  const noPrevious = rail(perPr('reviewWaitingTime', summary(40, { median: 1, p90: 1 }), summary(0, { median: null, p90: null })));
  expect(noPrevious).not.toContain('No comparison');
  expect(noPrevious).not.toContain('low sample');
  expect(rail(perPr('reviewWaitingTime', summary(3, { median: 1, p90: 1 }, true), summary(40, { median: 1, p90: 1 })))).toContain('low sample');
});

test('theMergedPrsTileStillComparesCountsWhenBothRangesAreLowSample', () => {
  const markup = tiles(perPr('reviewWaitingTime', summary(12, { median: 1, p90: 1 }, true), summary(3, { median: 1, p90: 1 }, true)));
  expect(markup).toContain('Merged PRs 12 vs 3 in the previous range');
  expect(markup).toContain('▲ 300%');
});
