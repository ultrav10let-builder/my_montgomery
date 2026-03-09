import { expect, test } from 'vitest';
import type { CivicSignal } from '../types';
import { buildDistrictInsight } from './districtInsights';

function makeSignal(overrides: Partial<CivicSignal>): CivicSignal {
  return {
    id: 'signal-1',
    snapshot_id: 'snapshot-1',
    event_at_utc: '2026-03-09T12:00:00.000Z',
    ingested_at_utc: '2026-03-09T12:05:00.000Z',
    event_time_confidence: 'HIGH',
    event_time_source: 'unit-test',
    category: 'Traffic',
    neighborhood: 'Downtown',
    district: '4',
    location_text: null,
    lat: null,
    lng: null,
    raw_json: '{}',
    created_at_utc: '2026-03-09T12:05:00.000Z',
    ...overrides,
  };
}

test('builds district insight metrics from scoped current and previous signals', () => {
  const insight = buildDistrictInsight({
    district: 'District 4',
    scopeSignals: [
      makeSignal({ id: '1', category: 'Traffic', neighborhood: 'Downtown' }),
      makeSignal({ id: '2', category: 'Traffic', neighborhood: 'Downtown' }),
      makeSignal({ id: '3', category: 'Sanitation', neighborhood: 'Old Cloverdale' }),
      makeSignal({ id: '4', district: '1', neighborhood: 'Capitol Heights' }),
    ],
    comparisonScopeSignals: [
      makeSignal({ id: '5', category: 'Traffic', neighborhood: 'Downtown' }),
      makeSignal({ id: '6', category: 'Traffic', neighborhood: 'Downtown' }),
      makeSignal({ id: '7', category: 'Traffic', neighborhood: 'Old Cloverdale' }),
      makeSignal({ id: '8', category: 'Traffic', neighborhood: 'Old Cloverdale' }),
      makeSignal({ id: '9', category: 'Sanitation', neighborhood: 'Old Cloverdale' }),
      makeSignal({ id: '10', district: '1', neighborhood: 'Capitol Heights' }),
    ],
    previousScopeSignals: [
      makeSignal({ id: '11', category: 'Traffic', neighborhood: 'Downtown' }),
      makeSignal({ id: '12', category: 'Traffic', neighborhood: 'Old Cloverdale' }),
      makeSignal({ id: '13', category: 'Sanitation', neighborhood: 'Old Cloverdale' }),
    ],
  });

  expect(insight.currentTotal).toBe(3);
  expect(insight.comparisonCurrentTotal).toBe(5);
  expect(insight.previousTotal).toBe(3);
  expect(insight.changeAbsolute).toBe(2);
  expect(insight.changePercent).toBeCloseTo(66.7, 1);
  expect(insight.topCategory).toBe('Traffic');
  expect(insight.topCategoryShare).toBeCloseTo(66.7, 1);
  expect(insight.shareOfScopedSignals).toBe(75);
  expect(insight.topNeighborhoods).toEqual([
    { neighborhood: 'Downtown', total: 2, share: 66.7 },
    { neighborhood: 'Old Cloverdale', total: 1, share: 33.3 },
  ]);
});

test('returns a zeroed district insight when the district has no mapped signals', () => {
  const insight = buildDistrictInsight({
    district: 'District 7',
    scopeSignals: [makeSignal({ district: '4' })],
  });

  expect(insight.currentTotal).toBe(0);
  expect(insight.topCategory).toBe('No mapped signals');
  expect(insight.topNeighborhoods).toEqual([]);
  expect(insight.changePercent).toBeUndefined();
});