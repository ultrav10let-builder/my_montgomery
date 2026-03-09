import { expect, test } from 'vitest';
import {
  getBrightDataStatusBadge,
  getDigestStatusBadge,
  getSignalStatusBadge,
} from './systemStatus';

test('reports scheduled Bright Data runs when the scheduler is configured', () => {
  const badge = getBrightDataStatusBadge({
    configured: true,
    intervalMinutes: 5,
    lastTrafficRun: '2026-03-09T12:00:00.000Z',
    lastDigestRun: '2026-03-09T12:05:00.000Z',
    lastTrafficError: null,
    lastDigestError: null,
  });

  expect(badge.label).toBe('Bright Data: Scheduled · 5m');
  expect(badge.tone).toBe('good');
  expect(badge.detail).toContain('Traffic');
  expect(badge.detail).toContain('Digest');
});

test('downgrades digest scrape failures when cached digest data is available', () => {
  expect(getBrightDataStatusBadge({
    configured: true,
    intervalMinutes: 5,
    lastTrafficRun: null,
    lastDigestRun: null,
    lastTrafficError: null,
    lastDigestError: 'No data scraped from whitelist URLs',
  }, false, {
    event_at: '2026-03-09T12:10:00.000Z',
    ingested_at: '2026-03-09T12:15:00.000Z',
    confidence: 'HIGH',
    source: 'brightdata',
  })).toMatchObject({
    label: 'Bright Data: Scheduled · 5m',
    tone: 'warn',
  });
});

test('reports traffic refresh delays without exposing raw backend scrape errors', () => {
  expect(getBrightDataStatusBadge({
    configured: true,
    intervalMinutes: 5,
    lastTrafficRun: null,
    lastDigestRun: null,
    lastTrafficError: 'ALDOT scrape failed',
    lastDigestError: null,
  })).toEqual({
    label: 'Bright Data: Traffic refresh delayed',
    tone: 'warn',
    detail: 'Awaiting next successful traffic scrape',
  });
});

test('reports digest freshness from metadata when available', () => {
  const badge = getDigestStatusBadge({
    event_at: '2026-03-09T12:10:00.000Z',
    ingested_at: '2026-03-09T12:15:00.000Z',
    confidence: 'HIGH',
    source: 'brightdata',
  });

  expect(badge.label).toBe('Digest: Updated');
  expect(badge.tone).toBe('good');
  expect(badge.detail).toContain('ingested');
});

test('reports signal loading and loaded states', () => {
  expect(getSignalStatusBadge(0, true)).toEqual({
    label: 'Signals: Syncing',
    detail: 'Loading current dashboard scope',
    tone: 'neutral',
  });

  expect(getSignalStatusBadge(42, false)).toEqual({
    label: 'Signals: 42 loaded',
    detail: 'Current dashboard scope',
    tone: 'good',
  });
});