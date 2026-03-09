import { expect, test } from 'vitest';
import { computeDistrictBreakdown } from './districtBreakdown';
import type { CivicSignal } from '../types';

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
    district: null,
    location_text: null,
    lat: null,
    lng: null,
    raw_json: '{}',
    created_at_utc: '2026-03-09T12:05:00.000Z',
    ...overrides,
  };
}

test('computeDistrictBreakdown prefers an explicit district when coordinates are absent', () => {
  const breakdown = computeDistrictBreakdown([
    makeSignal({ district: '4', neighborhood: 'Downtown' }),
  ]);

  const district4 = breakdown.find((entry) => entry.district === 'District 4');
  expect(district4?.total).toBe(1);
  expect(district4?.neighborhoods[0]?.neighborhood).toBe('Downtown');
});