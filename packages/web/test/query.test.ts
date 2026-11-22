import { expect, test } from 'vitest';
import { applyChoice, defaultQuery, isDayPeriodAllowed, queryKey, queryString, type Query } from '../src/query.js';

const today = new Date('2026-11-22T15:00:00Z');
const MAX_MONTHS = 12;

function query(overrides: Partial<Query> = {}): Query {
  return { repos: ['app'], since: '2026-01-01', until: '2026-03-20', period: 'monthly', ...overrides };
}

test('defaultQueryCoversTheLastTwelveMonthsMonthlyFromTheStartingRepositories', () => {
  expect(defaultQuery(['app', 'api'], today)).toEqual({ repos: ['app', 'api'], since: '2025-12-01', until: '2026-11-22', period: 'monthly' });
});

test('defaultRangeIsTheSameWhateverThePeriodLaterBecomes', () => {
  const { since, until } = defaultQuery(['app'], today);

  expect(queryKey({ ...defaultQuery(['app'], today), period: 'weekly' })).toContain(`${since}|${until}`);
});

test('queryKeyIncludesRepositoriesRangeAndPeriod', () => {
  expect(queryKey(query())).toBe('app|2026-01-01|2026-03-20|monthly');
});

test('queryKeyDiffersWhenOnlyThePeriodDiffers', () => {
  expect(queryKey(query({ period: 'weekly' }))).not.toBe(queryKey(query()));
});

test('queryStringSendsEveryPartOfTheQuery', () => {
  expect(queryString(query({ repos: ['a', 'b'] }), false)).toBe('repos=a%2Cb&since=2026-01-01&until=2026-03-20&period=monthly');
});

test('queryStringCanAskForARefresh', () => {
  expect(queryString(query(), true)).toContain('&refresh=true');
});

test('dayPeriodIsAllowedForExactlyTwelveMonths', () => {
  expect(isDayPeriodAllowed({ since: '2025-04-01', until: '2026-03-31' }, MAX_MONTHS)).toBe(true);
});

test('dayPeriodIsNotAllowedOverTwelveMonths', () => {
  expect(isDayPeriodAllowed({ since: '2025-03-31', until: '2026-03-31' }, MAX_MONTHS)).toBe(false);
});

test('applyingALongRangeFallsBackFromDayToWeek', () => {
  const applied = applyChoice(query({ period: 'daily', since: '2024-01-01' }), MAX_MONTHS);

  expect(applied.period).toBe('weekly');
});

test('applyingAShortRangeKeepsTheDayPeriod', () => {
  expect(applyChoice(query({ period: 'daily' }), MAX_MONTHS).period).toBe('daily');
});

test('queryKeyIgnoresTheOrderOfRepositories', () => {
  expect(queryKey(query({ repos: ['b', 'a'] }))).toBe(queryKey(query({ repos: ['a', 'b'] })));
});
