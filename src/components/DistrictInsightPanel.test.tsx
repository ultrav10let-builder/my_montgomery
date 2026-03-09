import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { DistrictInsightPanel } from './DistrictInsightPanel';

test('renders a placeholder state when no district is selected', () => {
  const markup = renderToStaticMarkup(
    <DistrictInsightPanel
      district={null}
      scopeSignals={[]}
      comparisonScopeSignals={[]}
      timeMode="7d"
    />,
  );

  expect(markup).toContain('District Insight · Select a district');
  expect(markup).toContain('Choose a district on the map to see scoped rates, top issue, and neighborhood activity.');
  expect(markup).toContain('Select a district to see neighborhood activity in the current scope.');
});

test('renders the selected district title when a district is provided', () => {
  const markup = renderToStaticMarkup(
    <DistrictInsightPanel
      district="District 4"
      scopeSignals={[]}
      comparisonScopeSignals={[]}
      timeMode="7d"
    />,
  );

  expect(markup).toContain('District Insight · District 4');
  expect(markup).not.toContain('Choose a district on the map to see scoped rates, top issue, and neighborhood activity.');
});