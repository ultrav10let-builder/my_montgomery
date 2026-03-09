import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TrendInsights } from './TrendInsights';

test('renders coordinate-mapping guidance in the data transparency strip', () => {
  const markup = renderToStaticMarkup(
    <TrendInsights
      trends={null}
      scopeSignals={[]}
      previousScopeSignals={[]}
      dataWindowStart="Jan 1"
      dataWindowEnd="Jan 7"
    />,
  );

  expect(markup).toContain('Data Transparency');
  expect(markup).toContain('Map shows only records with clear coordinates.');
  expect(markup).toContain('Window: Jan 1 → Jan 7');
});