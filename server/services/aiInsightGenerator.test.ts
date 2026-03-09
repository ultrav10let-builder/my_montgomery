import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSelectedProvider: vi.fn(),
  generateStructuredJsonWithProvider: vi.fn(),
  buildInsightInput: vi.fn(),
  getInsightCacheLabel: vi.fn(),
  getCachedRow: vi.fn(),
  runStatement: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock('../ai/summarizer', () => ({
  getSelectedProvider: mocks.getSelectedProvider,
  generateStructuredJsonWithProvider: mocks.generateStructuredJsonWithProvider,
}));

vi.mock('./insightInputBuilder', () => ({
  buildInsightInput: mocks.buildInsightInput,
}));

vi.mock('./trendEngine', () => ({
  getInsightCacheLabel: mocks.getInsightCacheLabel,
}));

vi.mock('../storage/db', () => ({
  default: {
    prepare: mocks.prepare,
  },
}));

import { generateInsight } from './aiInsightGenerator';

const SAMPLE_INPUT = {
  window: '7d',
  totalSignals: 7,
  signalsPer10k: 0.4,
  topCategories: [{ category: 'Civic', count: 2, delta: 1 }],
  topNeighborhoods: [{ neighborhood: 'District 4', count: 5, status: 'Elevated' }],
  notableChange: { type: 'neighborhood', name: 'West Montgomery', direction: 'down', delta: -8 },
  brightData: {
    traffic: [{ road: 'I-85', description: 'Crash near Eastern Blvd.' }],
    digest: [{ title: 'Council meeting update', category: 'Civic' }],
  },
  districtContext: undefined,
};

beforeEach(() => {
  mocks.prepare.mockImplementation((sql: string) => {
    if (sql.includes('SELECT insight, generated_at FROM insights_cache')) {
      return { get: mocks.getCachedRow };
    }
    if (sql.includes('INSERT INTO insights_cache')) {
      return { run: mocks.runStatement };
    }
    return { get: mocks.getCachedRow, run: mocks.runStatement };
  });
  mocks.getCachedRow.mockReturnValue(undefined);
  mocks.getSelectedProvider.mockReturnValue({
    provider: 'openai',
    openaiKeyPresent: true,
    geminiKeyPresent: false,
    configuredProvider: 'openai',
  });
  mocks.buildInsightInput.mockReturnValue(SAMPLE_INPUT);
  mocks.getInsightCacheLabel.mockImplementation((spec: string | { start: string; end: string }) =>
    typeof spec === 'string' ? spec : `custom:${spec.start}:${spec.end}`
  );
});

afterEach(() => {
  delete process.env.AI_INSIGHT_TIMEOUT_MS;
  vi.useRealTimers();
  vi.clearAllMocks();
});

test('generateInsight returns live insight when provider responds before timeout', async () => {
  process.env.AI_INSIGHT_TIMEOUT_MS = '50';
  mocks.generateStructuredJsonWithProvider.mockResolvedValue({
    insight: 'Civic requests remain elevated in District 4 due to recent crash activity.',
  });

  const result = await generateInsight('7d');

  expect(result.mode).toBe('live');
  expect(result.provider).toBe('openai');
  expect(result.insight).toContain('District 4');
  expect(mocks.runStatement).toHaveBeenCalledOnce();
});

test('generateInsight falls back when provider stalls past timeout', async () => {
  vi.useFakeTimers();
  process.env.AI_INSIGHT_TIMEOUT_MS = '10';
  mocks.generateStructuredJsonWithProvider.mockImplementation(() => new Promise(() => {}));

  const pending = generateInsight('7d');
  await vi.advanceTimersByTimeAsync(25);
  const result = await pending;

  expect(result.mode).toBe('fallback');
  expect(result.provider).toBe('fallback');
  expect(result.insight).toContain('Civic activity: 7 signals');
  expect(result.insight).toContain('District 4 shows Elevated pressure');
  expect(mocks.runStatement).toHaveBeenCalledOnce();
});