import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { CivicDigest } from './CivicDigest';
import type { DigestResponse } from '../types';

test('renders digest filters as pressed buttons and exposes rotation controls', () => {
  const digest: DigestResponse = {
    items: [
      { title: 'Road work update', summary: 'Lane closure on Dexter Ave.', source: 'City News', category: 'Traffic', url: 'https://www.montgomeryal.gov/news/1' },
      { title: 'Parks event', summary: 'Community event this weekend.', source: 'Parks', category: 'Parks', url: 'https://www.montgomeryal.gov/news/2' },
    ],
    sources: ['https://www.montgomeryal.gov/news'],
    metadata: { event_at: '2026-03-08T10:00:00.000Z', confidence: 'HIGH', source: 'City News' },
  };

  const markup = renderToStaticMarkup(
    <CivicDigest
      digest={digest}
      loading={false}
      selectedCategory="All"
      onCategoryChange={() => {}}
      onRefresh={() => {}}
    />,
  );

  expect(markup).toContain('aria-label="Filter digest by category"');
  expect(markup).not.toContain('role="tablist"');
  expect(markup).toContain('aria-pressed="true"');
  expect(markup).toContain('Pause rotation');
  expect(markup).toContain('aria-label="Refresh digest (admin)"');
});