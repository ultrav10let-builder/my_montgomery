import { expect, test } from 'vitest';
import {
  buildComparisonMovers,
  buildCurrentCategoryMix,
  formatComparisonValue,
  formatCurrentMixValue,
  getComparisonSummary,
  getCurrentMixSummary,
} from './trendInsights';

test('builds current category mix with counts and shares', () => {
  const mix = buildCurrentCategoryMix([
    { category: 'Sanitation' },
    { category: 'Sanitation' },
    { category: 'Traffic' },
  ]);

  expect(mix).toHaveLength(2);
  expect(mix[0].category).toBe('Sanitation');
  expect(mix[0].current).toBe(2);
  expect(mix[0].share).toBeCloseTo(66.67, 1);
  expect(mix[1].category).toBe('Traffic');
  expect(formatCurrentMixValue(mix[0])).toBe('67% share');
});

test('summarizes the current dashboard scope using the leading category', () => {
  const mix = buildCurrentCategoryMix([
    { category: 'Sanitation' },
    { category: 'Sanitation' },
    { category: 'Traffic' },
  ]);

  expect(getCurrentMixSummary(mix, 3)).toBe(
    '3 signals in the current dashboard scope. Sanitation leads with 67%.',
  );
});

test('formats comparison values for newly appearing categories', () => {
  expect(
    formatComparisonValue({
      category: 'Traffic',
      current: 4,
      previous: 0,
      percentChange: null,
    }),
  ).toBe('+4 new');
});

test('comparison summary calls out newly appearing categories', () => {
  expect(
    getComparisonSummary([
      { category: 'Traffic', current: 4, previous: 0, percentChange: null },
      { category: 'Sanitation', current: 3, previous: 2, percentChange: 50 },
    ]),
  ).toBe('Traffic newly appeared (4 signals). Sanitation up 50% (3 signals).');
});

test('builds scoped comparison movers from current and previous signals', () => {
  const movers = buildComparisonMovers(
    [
      { category: 'Traffic' },
      { category: 'Traffic' },
      { category: 'Sanitation' },
    ],
    [
      { category: 'Traffic' },
      { category: 'Public Safety' },
      { category: 'Public Safety' },
    ],
  );

  expect(movers).toEqual([
    { category: 'Public Safety', current: 0, previous: 2, percentChange: -100 },
    { category: 'Traffic', current: 2, previous: 1, percentChange: 100 },
    { category: 'Sanitation', current: 1, previous: 0, percentChange: null },
  ]);
});

test('comparison summary handles an empty matched scope', () => {
  expect(getComparisonSummary([])).toBe('No signals in this scope across the matched windows.');
});