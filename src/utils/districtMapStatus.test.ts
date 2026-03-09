import { expect, test } from 'vitest';
import type { DistrictBreakdown } from './districtBreakdown';
import { buildDistrictLayerKey, buildDistrictStatusSnapshot, getDistrictStatusSnapshot } from './districtMapStatus';

const breakdown: DistrictBreakdown[] = [
  {
    district: 'District 4',
    districtNumber: 4,
    total: 4,
    byCategory: [{ category: 'Traffic', count: 4 }],
    neighborhoods: [],
  },
];

test('looks up district status using normalized district names', () => {
  const statusByDistrict = buildDistrictStatusSnapshot(
    breakdown,
    new Map([['District 4', 80]]),
    new Map([['District 4', 'Traffic']])
  );

  expect(getDistrictStatusSnapshot(statusByDistrict, 'district 4')).toEqual({
    score: 80,
    total: 4,
    topIssue: 'Traffic',
  });
});

test('changes district layer key when district status changes', () => {
  const baseKey = buildDistrictLayerKey({
    mapMode: 'pressure',
    selectedCategory: null,
    selectedDistrict: null,
    timeLabel: '7 days',
    statusByDistrict: buildDistrictStatusSnapshot(
      breakdown,
      new Map([['District 4', 25]]),
      new Map([['District 4', 'Traffic']])
    ),
  });

  const updatedKey = buildDistrictLayerKey({
    mapMode: 'pressure',
    selectedCategory: null,
    selectedDistrict: null,
    timeLabel: '7 days',
    statusByDistrict: buildDistrictStatusSnapshot(
      breakdown,
      new Map([['District 4', 80]]),
      new Map([['District 4', 'Traffic']])
    ),
  });

  expect(updatedKey).not.toBe(baseKey);
});