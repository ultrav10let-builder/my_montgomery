import { expect, test } from 'vitest';
import { countSignalsByDistrict, hydrateSignalLocation } from './signalHydration';

test('hydrateSignalLocation prefers source-provided district and normalizes category/neighborhood', () => {
  const hydrated = hydrateSignalLocation({
    category: 'public-safety',
    neighborhood: 'downtown',
    lat: null,
    lng: null,
    raw_json: JSON.stringify({ attributes: { DISTRICT: 'Ward 4' } }),
  });

  expect(hydrated.category).toBe('Public Safety');
  expect(hydrated.neighborhood).toBe('Downtown');
  expect(hydrated.district).toBe('District 4');
  expect(hydrated.location_text).toContain('Downtown');
});

test('countSignalsByDistrict falls back to polygon matching when raw district is absent', () => {
  const counts = countSignalsByDistrict([
    {
      category: 'Traffic',
      neighborhood: 'Downtown',
      lat: 32.3668,
      lng: -86.3000,
      raw_json: JSON.stringify({ description: 'Downtown traffic issue' }),
    },
  ]);

  expect(counts.length).toBeGreaterThan(0);
  expect(counts[0].district).toMatch(/^District\s[1-9]$/);
  expect(counts[0].count).toBe(1);
});