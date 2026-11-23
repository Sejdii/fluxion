import { expect, test } from 'vitest';
import { monthChunks } from '../src/month-chunks.js';

test('shouldReturnOneChunkForARangeInsideOneMonth', () => {
  expect(monthChunks({ since: '2026-03-05', until: '2026-03-20' })).toEqual([{ since: '2026-03-05', until: '2026-03-20' }]);
});

test('shouldClipTheFirstAndLastChunkToTheRangeEdges', () => {
  expect(monthChunks({ since: '2025-12-10', until: '2026-02-03' })).toEqual([
    { since: '2025-12-10', until: '2025-12-31' },
    { since: '2026-01-01', until: '2026-01-31' },
    { since: '2026-02-01', until: '2026-02-03' },
  ]);
});

test('shouldReturnWholeMonthsWhenTheRangeCoversThem', () => {
  expect(monthChunks({ since: '2026-01-01', until: '2026-02-28' })).toEqual([
    { since: '2026-01-01', until: '2026-01-31' },
    { since: '2026-02-01', until: '2026-02-28' },
  ]);
});

test('shouldEndFebruaryOnTheTwentyNinthInALeapYear', () => {
  expect(monthChunks({ since: '2028-02-01', until: '2028-03-01' })).toEqual([
    { since: '2028-02-01', until: '2028-02-29' },
    { since: '2028-03-01', until: '2028-03-01' },
  ]);
});

test('shouldSplitAtTheYearBoundary', () => {
  expect(monthChunks({ since: '2025-12-31', until: '2026-01-01' })).toEqual([
    { since: '2025-12-31', until: '2025-12-31' },
    { since: '2026-01-01', until: '2026-01-01' },
  ]);
});
