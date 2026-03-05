import { expect, test } from 'vitest';
import { calculateTrend } from './trendEngine';

test('calculates percentage change correctly', () => {
  expect(calculateTrend(120, 100)).toBe(20);
});

test('handles decrease correctly', () => {
  expect(calculateTrend(80, 100)).toBe(-20);
});

test('handles zero previous value', () => {
  expect(calculateTrend(100, 0)).toBe(0);
});
