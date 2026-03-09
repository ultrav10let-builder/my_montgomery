import { expect, test } from 'vitest';
import type { CivicSignal, TrendResponse } from '../types';
import { buildCitySnapshotFromSignals, buildCityWideSnapshotStats, buildDistrictSnapshotFromSignals } from './citySnapshot';

function makeSignal(overrides: Partial<CivicSignal> = {}): CivicSignal {
  return {
    id: overrides.id ?? 'signal-1',
    snapshot_id: overrides.snapshot_id ?? 'snapshot-1',
    event_at_utc: overrides.event_at_utc ?? '2026-03-08T12:00:00.000Z',
    ingested_at_utc: overrides.ingested_at_utc ?? '2026-03-08T12:05:00.000Z',
    event_time_confidence: overrides.event_time_confidence ?? 'HIGH',
    event_time_source: overrides.event_time_source ?? 'open_data',
    category: overrides.category ?? 'Traffic',
    neighborhood: overrides.neighborhood ?? 'Downtown',
    district: overrides.district ?? 'District 1',
    location_text: overrides.location_text ?? null,
    lat: overrides.lat ?? null,
    lng: overrides.lng ?? null,
    raw_json: overrides.raw_json ?? '{}',
    created_at_utc: overrides.created_at_utc ?? '2026-03-08T12:05:00.000Z',
  };
}

function makeTrends(overrides: Partial<TrendResponse> = {}): TrendResponse {
  return {
    windowA: overrides.windowA ?? {
      start: '2026-03-02T06:00:00.000Z',
      end: '2026-03-09T04:59:59.999Z',
      stats: {
        total: 8,
        byCategory: [{ category: 'Sanitation', count: 4 }],
        byNeighborhood: [{ neighborhood: 'Old Cloverdale', count: 3 }],
      },
    },
    windowB: overrides.windowB ?? {
      start: '2026-02-24T06:00:00.000Z',
      end: '2026-03-02T05:59:59.999Z',
      stats: { total: 10, byCategory: [], byNeighborhood: [] },
    },
    signalsPer10k: overrides.signalsPer10k,
    signalsPer10kChange: overrides.signalsPer10kChange,
    categoryMovers: overrides.categoryMovers ?? [],
    neighborhoodMovers: overrides.neighborhoodMovers,
    overallChange: overrides.overallChange ?? -2,
    overallPercentChange: overrides.overallPercentChange ?? -20,
    confidenceBreakdown: overrides.confidenceBreakdown,
  };
}

test('builds city snapshot fallback values from live signals', () => {
  const stats = buildCitySnapshotFromSignals([
    makeSignal({ id: 'a', category: 'Traffic', neighborhood: 'Downtown' }),
    makeSignal({ id: 'b', category: 'Traffic', neighborhood: 'Downtown' }),
    makeSignal({ id: 'c', category: 'Sanitation', neighborhood: 'Cloverdale' }),
  ]);

  expect(stats).toEqual({
    totalRequests: 3,
    topCategory: 'Traffic',
    activeNeighborhood: 'Downtown',
    signalsPer10k: 0.2,
  });
});

test('builds district snapshot values using district population share', () => {
  const stats = buildDistrictSnapshotFromSignals([
    makeSignal({ id: 'a', district: 'District 4', category: 'Traffic', neighborhood: 'Downtown' }),
    makeSignal({ id: 'b', district: 'District 4', category: 'Traffic', neighborhood: 'Downtown' }),
    makeSignal({ id: 'c', district: 'District 4', category: 'Sanitation', neighborhood: 'Old Cloverdale' }),
  ]);

  expect(stats).toEqual({
    totalRequests: 3,
    topCategory: 'Traffic',
    activeNeighborhood: 'Downtown',
    signalsPer10k: 1.4,
  });
});

test('uses trend response for comparison values and per-10k change', () => {
  const stats = buildCityWideSnapshotStats([makeSignal()], makeTrends({
    signalsPer10k: 12.3,
    signalsPer10kChange: -5.4,
  }));

  expect(stats).toEqual({
    totalRequests: 8,
    changePercent: -20,
    topCategory: 'Sanitation',
    activeNeighborhood: 'Old Cloverdale',
    signalsPer10k: 12.3,
    signalsPer10kChange: -5.4,
  });
});

test('falls back to signal-derived stats when trend data is missing or empty', () => {
  const stats = buildCityWideSnapshotStats([
    makeSignal({ id: 'a', category: 'Parks', neighborhood: 'Capitol Heights' }),
    makeSignal({ id: 'b', category: 'Parks', neighborhood: 'Capitol Heights' }),
  ], makeTrends({
    windowA: {
      start: '2026-03-02T06:00:00.000Z',
      end: '2026-03-09T04:59:59.999Z',
      stats: { total: 0, byCategory: [], byNeighborhood: [] },
    },
    signalsPer10k: 0,
    signalsPer10kChange: null,
    overallPercentChange: 0,
  }));

  expect(stats).toEqual({
    totalRequests: 2,
    topCategory: 'Parks',
    activeNeighborhood: 'Capitol Heights',
    signalsPer10k: 0.1,
  });
});