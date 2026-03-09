import { describe, expect, test } from 'vitest';
import {
  hasValidAdminToken,
  parseBrightDataHealthQuery,
  parseInsightsQuery,
  parseTrafficFeedsQuery,
} from './requestValidation';

describe('parseInsightsQuery', () => {
  test('normalizes live window and district shorthand', () => {
    const result = parseInsightsQuery({ window: 'live', district: '3' });
    expect(result).toEqual({ success: true, spec: '7d', district: 'District 3' });
  });

  test('accepts custom ranges and rejects reversed dates', () => {
    expect(parseInsightsQuery({ start: '2025-02-01', end: '2025-02-15' })).toEqual({
      success: true,
      spec: { start: '2025-02-01', end: '2025-02-15' },
      district: undefined,
    });

    expect(parseInsightsQuery({ start: '2025-02-15', end: '2025-02-01' })).toEqual({
      success: false,
      error: 'start must be before or equal to end',
    });
  });

  test('rejects partial custom ranges and invalid district values', () => {
    const partial = parseInsightsQuery({ start: '2025-02-01' });
    expect(partial.success).toBe(false);
    expect(partial).toMatchObject({ error: 'end: Provide both start and end for a custom insight range' });

    expect(parseInsightsQuery({ district: 'District 11' })).toEqual({
      success: false,
      error: 'Invalid district. Use 1–9 or District N',
    });
  });
});

describe('requestValidation helpers', () => {
  test('parses Bright Data health targets conservatively', () => {
    expect(parseBrightDataHealthQuery({})).toEqual({ success: true, useCity: false });
    expect(parseBrightDataHealthQuery({ target: 'city' })).toEqual({ success: true, useCity: true });
    expect(parseBrightDataHealthQuery({ target: 'other' })).toEqual({
      success: false,
      error: 'target: Use target=city or omit target',
    });
  });

  test('parses traffic live flag and rejects invalid values', () => {
    expect(parseTrafficFeedsQuery({ live: 'true' })).toEqual({ success: true, live: true });
    expect(parseTrafficFeedsQuery({ live: '0' })).toEqual({ success: true, live: false });
    expect(parseTrafficFeedsQuery({ live: 'maybe' })).toEqual({
      success: false,
      error: 'live: Use live=true, live=false, live=1, or live=0',
    });
  });

  test('requires an exact string admin token', () => {
    expect(hasValidAdminToken({ 'x-admin-token': 'secret' }, 'secret')).toBe(true);
    expect(hasValidAdminToken({ 'x-admin-token': ['secret'] }, 'secret')).toBe(false);
    expect(hasValidAdminToken({}, 'secret')).toBe(false);
  });
});