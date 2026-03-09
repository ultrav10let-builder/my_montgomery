import { expect, test } from 'vitest';
import { getAIInsightStatusDisplay } from './aiInsightStatus';

test('reports working OpenAI status for live insight responses', () => {
  expect(
    getAIInsightStatusDisplay({
      loading: false,
      error: false,
      hasContent: true,
      mode: 'live',
      provider: 'openai',
    })
  ).toEqual({ label: 'AI: Working · OpenAI', tone: 'live' });
});

test('reports cached fallback status when insight content is cached', () => {
  expect(
    getAIInsightStatusDisplay({
      loading: false,
      error: false,
      hasContent: true,
      mode: 'cached',
      provider: 'cached-fallback',
    })
  ).toEqual({ label: 'AI: Cached · Fallback', tone: 'cached' });
});

test('reports unavailable status when the insight request fails', () => {
  expect(
    getAIInsightStatusDisplay({
      loading: false,
      error: true,
      hasContent: false,
    })
  ).toEqual({ label: 'AI: Unavailable', tone: 'unavailable' });
});