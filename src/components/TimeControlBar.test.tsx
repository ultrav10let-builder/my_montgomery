import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TimeControlBar } from './TimeControlBar';

test('renders pressed-button time controls and an accessible compare switch', () => {
  const markup = renderToStaticMarkup(
    <TimeControlBar
      mode="custom"
      onModeChange={() => {}}
      customRange={{ start: '2026-03-01', end: '2026-03-07' }}
      onCustomRangeChange={() => {}}
      compare
      onCompareToggle={() => {}}
    />,
  );

  expect(markup).toContain('aria-label="Select data time range"');
  expect(markup).not.toContain('role="tablist"');
  expect(markup).toContain('aria-pressed="true"');
  expect(markup).toContain('role="switch"');
  expect(markup).toContain('aria-label="Custom date range"');
});