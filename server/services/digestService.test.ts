import { expect, test } from 'vitest';
import { ensureExternalGovUrl, inferDigestLocationContext, sanitizeDigestItems } from './digestService';

test('infers district, neighborhood, and corridor anchors from digest text', () => {
  const location = inferDigestLocationContext({
    title: 'Road Closure on Bell Rd',
    summary: 'Detour near Eastern Blvd in West Montgomery for District 3 residents.',
    source: 'Traffic Engineering',
  });

  expect(location.district).toBe('District 3');
  expect(location.neighborhood).toBe('West Montgomery');
  expect(location.location_text).toContain('West Montgomery');
  expect(location.location_text).toContain('District 3');
  expect(location.location_text).toContain('Eastern Blvd');
});

test('sanitizeDigestItems maps traffic items to the traffic-engineering source', () => {
  const [item] = sanitizeDigestItems([
    { title: 'Madison Ave lane closure', summary: 'Repairs this week', source: 'Traffic Engineering', category: 'traffic' },
  ]);

  expect(item.category).toBe('Traffic');
  expect(item.url).toBe('https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering');
});

test('sanitizeDigestItems preserves and normalizes location metadata', () => {
  const [item] = sanitizeDigestItems([
    {
      title: 'Holiday pickup change',
      summary: 'Adjusted sanitation route this week.',
      source: 'Sanitation Department',
      category: 'public-safety',
      district: '4',
      neighborhood: 'downtown',
    },
  ]);

  expect(item.category).toBe('Public Safety');
  expect(item.district).toBe('District 4');
  expect(item.neighborhood).toBe('Downtown');
  expect(item.location_text).toContain('Downtown');
  expect(item.location_text).toContain('District 4');
});

test('ensureExternalGovUrl rewrites stale Montgomery shortcuts to working official pages', () => {
  expect(ensureExternalGovUrl('https://www.montgomeryal.gov/city-council')).toBe(
    'https://www.montgomeryal.gov/government/city-government/city-council'
  );
  expect(ensureExternalGovUrl('https://www.montgomeryal.gov/departments/public-works')).toBe(
    'https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services'
  );
  expect(ensureExternalGovUrl('https://www.montgomeryal.gov/departments/public-safety')).toBe(
    'https://www.montgomeryal.gov/city-government/departments/public-safety-test'
  );
});