import { expect, test } from 'vitest';
import { applyChoice, countQueryString, defaultQuery, SLOW_LOAD_PULL_REQUEST_COUNT, startingQuery, isDayPeriodAllowed, queryKey, queryString, snapToYears, yearChoices, yearRange, yearsOf, type Query } from '../src/query.js';

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
  expect(queryKey(query())).toBe('app|2026-01-01|2026-03-20|monthly|server|always');
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

test('yearRangeRunsFromTheFirstOfTheFromYearToTheEndOfTheToYear', () => {
  expect(yearRange(2020, 2022, today)).toEqual({ since: '2020-01-01', until: '2022-12-31' });
});

test('yearRangeEndsTodayWhenTheToYearIsTheCurrentYear', () => {
  expect(yearRange(2025, 2026, today)).toEqual({ since: '2025-01-01', until: '2026-11-22' });
});

test('aSingleYearIsAWholeYearRange', () => {
  expect(yearRange(2024, 2024, today)).toEqual({ since: '2024-01-01', until: '2024-12-31' });
});

test('snapToYearsCoversAPastRangeWithWholeYears', () => {
  expect(snapToYears({ since: '2021-03-10', until: '2023-02-01' }, today)).toEqual({ since: '2021-01-01', until: '2023-12-31' });
});

test('snapToYearsStopsAtTodayWhenTheRangeReachesTheCurrentYear', () => {
  expect(snapToYears({ since: '2025-12-01', until: '2026-11-22' }, today)).toEqual({ since: '2025-01-01', until: '2026-11-22' });
});

test('snapToYearsLeavesAWholeYearRangeUnchanged', () => {
  expect(snapToYears({ since: '2024-01-01', until: '2024-12-31' }, today)).toEqual({ since: '2024-01-01', until: '2024-12-31' });
});

test('yearChoicesRunFromTheEarliestSupportedYearToTheCurrentYear', () => {
  expect(yearChoices(today)).toEqual([2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
});

test('yearsOfReadsTheYearsOfAnyRange', () => {
  expect(yearsOf({ since: '2025-12-01', until: '2026-11-22' })).toEqual({ from: 2025, to: 2026 });
});

test('aRepositoryAtOrBelowTheSlowLoadCountStartsWithTheDefaultRangeAndNoNotice', () => {
  expect(startingQuery(['app'], today, SLOW_LOAD_PULL_REQUEST_COUNT)).toEqual({ query: defaultQuery(['app'], today), notice: null });
});

test('anUnknownCountStartsWithTheDefaultRangeAndNoNotice', () => {
  expect(startingQuery(['app'], today, null)).toEqual({ query: defaultQuery(['app'], today), notice: null });
});

test('aRepositoryAboveTheSlowLoadCountStartsWithTheLastThreeMonthsAndANoticeWithTheCount', () => {
  const starting = startingQuery(['app'], today, SLOW_LOAD_PULL_REQUEST_COUNT + 1);

  expect(starting.query).toEqual({ repos: ['app'], since: '2026-09-01', until: '2026-11-22', period: 'monthly' });
  expect(starting.notice).toContain(`${(SLOW_LOAD_PULL_REQUEST_COUNT + 1).toLocaleString('en-US')} merged PRs`);
});

test('countQueryStringSendsOnlyRepositoriesAndRange', () => {
  expect(countQueryString(query({ repos: ['a', 'b'] }))).toBe('repos=a%2Cb&since=2026-01-01&until=2026-03-20');
});
