import type { DashboardMetric } from '@fluxion/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { loadComparisonMode, saveComparisonMode } from '../src/comparison-storage.js';
import { Controls } from '../src/Controls.js';
import { queryKey, queryString, type Query } from '../src/query.js';
import { Rail } from '../src/Rail.js';
import { Tiles } from '../src/Tiles.js';

const skippedMetric: DashboardMetric = {
  id: 'reviewWaitingTime',
  unit: 'hours',
  rows: [],
  tiles: { current: { n: 3, values: { median: 20, p90: 40 }, lowSample: true }, previous: { skipped: 'turnedOff' } },
};
const sentence = 'No comparison: the comparison is turned off in Settings.';
const query: Query = { repos: ['app'], since: '2026-01-01', until: '2026-02-01', period: 'monthly', compare: 'always' };

function memory(initial?: string) {
  const items = new Map<string, string>(initial === undefined ? [] : [['fluxion.compare', initial]]);
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

test('everyTileOfASkippedComparisonShowsADashThatSaysItIsTurnedOff', () => {
  const markup = renderToStaticMarkup(<Tiles metric={skippedMetric} previousRange={{ since: '2025-12-01', until: '2025-12-31' }} lowSampleThreshold={5} />);

  expect(markup.match(new RegExp(`class="change change-none" aria-label="${sentence}"`, 'g'))).toHaveLength(3);
  expect(markup.match(/>—<\/span>/g)).toHaveLength(3);
  expect(markup).toContain(`>${sentence}</span>`);
});

test('theRailShowsNoChangeForASkippedComparison', () => {
  const markup = renderToStaticMarkup(<Rail metrics={[skippedMetric]} selectedId="reviewWaitingTime" onSelect={() => undefined} controls={null} loading={false} />);

  expect(markup).toContain('aria-label="Review waiting time, 20h, low sample"');
  expect(markup).not.toContain('%');
});

test('aSavedComparisonModeComesBack', () => {
  const storage = memory();

  saveComparisonMode(storage, 'never');

  expect(loadComparisonMode(storage)).toBe('never');
});

test.each([[undefined], ['sometimes']])('anUnusableStoredComparisonModeMeansNoChoice%#', (stored) => {
  expect(loadComparisonMode(memory(stored))).toBeUndefined();
});

test('queryStringLeavesAnUnchosenComparisonModeToTheServer', () => {
  expect(queryString({ repos: ['app'], since: '2026-01-01', until: '2026-02-01', period: 'monthly' }, false)).not.toContain('compare');
});

test('queryStringSendsTheComparisonMode', () => {
  expect(new URLSearchParams(queryString({ ...query, compare: 'never' }, false)).get('compare')).toBe('never');
});

test('queryKeyDiffersByComparisonMode', () => {
  expect(queryKey({ ...query, compare: 'never' })).not.toBe(queryKey(query));
});

test('settingsOfferTheComparisonChoicesWithTheAppliedOneSelected', () => {
  const markup = renderToStaticMarkup(
    <Controls options={[{ path: 'app', name: 'app' }]} applied={{ ...query, compare: 'never' }} dayPeriodMaxMonths={12} today={new Date('2026-03-20T10:00:00Z')} onApply={() => undefined} disabled={false} />,
  );

  expect(markup).toContain('Compare with previous range');
  expect(markup).toMatch(/<input type="radio"[^>]*checked=""[^>]*\/>Never/);
  expect(markup).not.toMatch(/<input type="radio"[^>]*checked=""[^>]*\/>Always/);
});
