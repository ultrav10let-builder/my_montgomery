import { expect, test } from 'vitest';
import type { CivicSignal } from '../types';
import {
  filterSignalsByCategory,
  hasSignalCoordinates,
  matchesTrafficCategory,
  scopeSignalsToMapSelection,
  shouldShowCategoryFilters,
  shouldUseTrafficFeeds,
} from './civicMapFilters';

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

test('matches traffic-related categories from open data labels', () => {
  expect(matchesTrafficCategory('Road Closure')).toBe(true);
  expect(matchesTrafficCategory('Traffic')).toBe(true);
  expect(matchesTrafficCategory('Sanitation')).toBe(false);
});

test('filters signals by exact category and grouped traffic category', () => {
  const signals = [
    makeSignal({ id: 'a', category: 'Traffic' }),
    makeSignal({ id: 'b', category: 'Road Closure' }),
    makeSignal({ id: 'c', category: 'Sanitation' }),
  ];

  expect(filterSignalsByCategory(signals, 'Traffic').map((signal) => signal.id)).toEqual(['a', 'b']);
  expect(filterSignalsByCategory(signals, 'Sanitation').map((signal) => signal.id)).toEqual(['c']);
});

test('scopes signals to the selected district after applying map category filters', () => {
  const signals = [
    makeSignal({ id: 'a', district: 'District 4', category: 'Traffic' }),
    makeSignal({ id: 'b', district: 'District 4', category: 'Sanitation' }),
    makeSignal({ id: 'c', district: 'District 2', category: 'Traffic' }),
  ];

  expect(scopeSignalsToMapSelection(signals, {
    selectedDistrict: 'District 4',
    selectedCategory: 'Traffic',
    mapMode: 'calls',
  }).map((signal) => signal.id)).toEqual(['a']);
});

test('does not apply category filtering in resources mode when scoping signals', () => {
  const signals = [
    makeSignal({ id: 'a', district: 'District 4', category: 'Traffic' }),
    makeSignal({ id: 'b', district: 'District 4', category: 'Sanitation' }),
    makeSignal({ id: 'c', district: 'District 2', category: 'Traffic' }),
  ];

  expect(scopeSignalsToMapSelection(signals, {
    selectedDistrict: 'District 4',
    selectedCategory: 'Traffic',
    mapMode: 'resources',
  }).map((signal) => signal.id)).toEqual(['a', 'b']);
});

test('shows category filters in pressure and calls modes only', () => {
  expect(shouldShowCategoryFilters('pressure')).toBe(true);
  expect(shouldShowCategoryFilters('calls')).toBe(true);
  expect(shouldShowCategoryFilters('resources')).toBe(false);
});

test('detects mappable signals by coordinates', () => {
  expect(hasSignalCoordinates(makeSignal({ lat: 32.3, lng: -86.2 }))).toBe(true);
  expect(hasSignalCoordinates(makeSignal({ lat: null, lng: -86.2 }))).toBe(false);
});

test('uses live traffic feeds only for live traffic calls view', () => {
  expect(shouldUseTrafficFeeds(true, 'calls', 'Traffic')).toBe(true);
  expect(shouldUseTrafficFeeds(false, 'calls', 'Traffic')).toBe(false);
  expect(shouldUseTrafficFeeds(true, 'pressure', 'Traffic')).toBe(false);
  expect(shouldUseTrafficFeeds(true, 'calls', 'Sanitation')).toBe(false);
});