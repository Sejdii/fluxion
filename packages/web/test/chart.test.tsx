import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Chart, Sparkline, type ChartPeriod } from '../src/chart/index.js';

function period(name: string, median: number | null, overrides: Partial<ChartPeriod> = {}): ChartPeriod {
  return { period: name, n: median === null ? 0 : 10, median, p90: median === null ? null : median * 2, lowSample: false, inProgress: false, ...overrides };
}

function draw(periods: ChartPeriod[], kind: 'line' | 'bars' = 'line'): string {
  return renderToStaticMarkup(<Chart kind={kind} periods={periods} label="Median per period" format={String} />);
}

function count(markup: string, pattern: RegExp): number {
  return markup.match(pattern)?.length ?? 0;
}

test('aGapSplitsTheMedianLineIntoTwoPaths', () => {
  const markup = draw([period('a', 1), period('b', 2), period('c', null), period('d', 3), period('e', 4)]);

  expect(count(markup, /class="median"/g)).toBe(2);
});

test('aGapIsNeverBridgedByAnyLine', () => {
  const markup = draw([period('a', 1), period('b', null), period('c', 3)]);

  expect(count(markup, /class="median"/g)).toBe(0);
});

test('aSingleIsolatedPeriodIsDrawnAsAMarkerOnly', () => {
  const markup = draw([period('a', 1), period('b', null), period('c', 3)]);

  expect(count(markup, /class="marker"/g)).toBe(2);
});

test('theInProgressPeriodIsJoinedByADashedSegment', () => {
  const markup = draw([period('a', 1), period('b', 2), period('c', 3, { inProgress: true })]);

  expect(markup).toMatch(/class="in-progress"[^>]*stroke-dasharray="4 3"/);
});

test('theInProgressPeriodIsNotPartOfTheSolidLine', () => {
  const markup = draw([period('a', 1), period('b', 2), period('c', 3, { inProgress: true })]);

  expect(count(markup, /class="median"/g)).toBe(1);
});

test('theInProgressPeriodIsLabelledInTheTooltipSource', () => {
  const markup = draw([period('a', 1), period('b', 2, { inProgress: true })]);

  expect(markup).toContain('in-progress');
});

test('aLowSamplePointIsFadedAndTaggedLowN', () => {
  const markup = draw([period('a', 1), period('b', 2, { lowSample: true })]);

  expect(markup).toMatch(/class="marker low-n"[^>]*stroke-opacity="0.45"/);
  expect(markup).toContain('>low n<');
});

test('aLowSamplePeriodHasNoP90', () => {
  const markup = draw([period('a', 1, { lowSample: true }), period('b', 2, { lowSample: true })]);

  expect(count(markup, /class="p90"/g)).toBe(0);
});

test('p90IsDrawnWithABandWhenSamplesAreEnough', () => {
  const markup = draw([period('a', 1), period('b', 2)]);

  expect(count(markup, /class="(p90|band)"/g)).toBe(2);
});

test('p90DiffersFromTheMedianByStyleAndWeight', () => {
  const markup = draw([period('a', 1), period('b', 2)]);

  expect(markup).toMatch(/class="median"[^>]*stroke-width="2.5"/);
  expect(markup).toMatch(/class="p90"[^>]*stroke-width="1.5"[^>]*stroke-dasharray="1 4"/);
});

test('sampleSizeIsDrawnAsBarsUnderTheLines', () => {
  const markup = draw([period('a', 1), period('b', 2), period('c', null)]);

  expect(count(markup, /class="n-bar"/g)).toBe(2);
});

test('barsKindDrawsOneBarPerNonEmptyPeriod', () => {
  const markup = draw([period('a', 4), period('b', null), period('c', 6)], 'bars');

  expect(count(markup, /class="count-bar"/g)).toBe(2);
});

test('barsKindDrawsNoLines', () => {
  const markup = draw([period('a', 4), period('b', 5)], 'bars');

  expect(count(markup, /class="median"/g)).toBe(0);
});

test('theChartIsLabelledForAssistiveTechnology', () => {
  const markup = draw([period('a', 1)]);

  expect(markup).toContain('role="img" aria-label="Median per period"');
});

test('sparklineIsHiddenFromAssistiveTechnology', () => {
  const markup = renderToStaticMarkup(<Sparkline kind="line" periods={[period('a', 1), period('b', 2)]} />);

  expect(markup).toContain('aria-hidden="true"');
});

test('sparklineBreaksAtGapsToo', () => {
  const markup = renderToStaticMarkup(<Sparkline kind="line" periods={[period('a', 1), period('b', 2), period('c', null), period('d', 3), period('e', 4)]} />);

  expect(count(markup, /class="median"/g)).toBe(2);
});

test('sparklineOmitsP90', () => {
  const markup = renderToStaticMarkup(<Sparkline kind="line" periods={[period('a', 1), period('b', 2)]} />);

  expect(count(markup, /class="p90"/g)).toBe(0);
});

test('sparklineShowsAnIsolatedPeriodAsADot', () => {
  const markup = renderToStaticMarkup(<Sparkline kind="line" periods={[period('a', 1), period('b', null), period('c', 3)]} />);

  expect(count(markup, /class="spark-dot"/g)).toBe(2);
});

test('chartWithOnlyEmptyPeriodsHasDistinctAxisLabels', () => {
  const markup = draw([period('a', null), period('b', null)]);

  expect(count(markup, /class="axis"/g)).toBe(5);
});
