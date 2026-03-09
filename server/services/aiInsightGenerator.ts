/**
 * AI Insight Generator – civic insights from structured insight input.
 * Uses buildInsightInput(window), OpenAI/Gemini when available, deterministic fallback when not.
 * Cached 10 minutes; 120-word limit; safe logs (no key or full prompt).
 * Provider selection: AI_PROVIDER=openai|gemini|auto.
 */

import {
  getSelectedProvider,
  generateStructuredJsonWithProvider,
  type SelectedProvider,
} from '../ai/summarizer';
import { getInsightCacheLabel } from './trendEngine';
import type { WindowOrRange } from './trendEngine';
import { buildInsightInput } from './insightInputBuilder';
import type { InsightInput } from './insightInputBuilder';
import db from '../storage/db';

const CACHE_TTL_MINUTES = 10;
const MAX_INSIGHT_WORDS = 120;
const MAX_INSIGHT_TOKENS = 200;
const DEFAULT_AI_INSIGHT_TIMEOUT_MS = 15000;

export type InsightProvider =
  | 'openai'
  | 'gemini'
  | 'fallback'
  | 'cached-openai'
  | 'cached-gemini'
  | 'cached-fallback';

export type InsightResult = {
  window: string;
  mode: 'live' | 'fallback' | 'cached';
  provider: InsightProvider;
  generatedAt: string;
  insight: string;
};

function getAiInsightTimeoutMs(): number {
  const configured = Number.parseInt(process.env.AI_INSIGHT_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AI_INSIGHT_TIMEOUT_MS;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function ensureProviderColumn(): void {
  try {
    db.prepare('ALTER TABLE insights_cache ADD COLUMN provider TEXT').run();
  } catch {
    /* column already exists */
  }
}

/** Build compact prompt from structured input. Neutral civic tone; no speculation beyond data. */
function buildPrompt(input: InsightInput): string {
  const cats = input.topCategories.map((c) => `${c.category}:${c.count}(${c.delta >= 0 ? '+' : ''}${c.delta})`).join(',');
  const neighs = input.topNeighborhoods.map((n) => `${n.neighborhood}:${n.status}`).join(',');
  const notable = input.notableChange
    ? `${input.notableChange.type} ${input.notableChange.name} ${input.notableChange.direction} ${Math.abs(input.notableChange.delta)}`
    : 'none';
  const events = [
    ...input.brightData.traffic.map((t) => t.road ? `${t.road}: ${t.description}` : t.description),
    ...input.brightData.digest.map((d) => d.title),
  ].join(';') || 'none';
  const scope = input.districtContext
    ? `PRIORITIZE ${input.districtContext}. Data below is filtered to this district.`
    : 'Identify citywide trends.';
  return `Montgomery civic data (${input.window}): Signals ${input.totalSignals} (${input.signalsPer10k}/10k). Top categories: ${cats}. Top neighborhoods: ${neighs}. Notable change: ${notable}. Recent events: ${events}.

${scope} Write ONE insight under ${MAX_INSIGHT_WORDS} words. Identify: 1) most important trend for this scope 2) neighborhood/district pressure 3) category driving demand 4) relevant recent event if present. Neutral tone, no speculation beyond data. JSON only: {"insight":"..."}`;
}

/** Deterministic fallback from InsightInput. Never returns blank. */
function buildFallbackFromInput(input: InsightInput): string {
  const parts: string[] = [];
  const scope = input.districtContext ? `${input.districtContext}: ` : '';
  parts.push(`${scope}Civic activity: ${input.totalSignals} signals (${input.signalsPer10k} per 10k residents).`);
  const topCat = input.topCategories[0];
  if (topCat) {
    const d = topCat.delta !== 0 ? ` (${topCat.delta >= 0 ? '+' : ''}${topCat.delta} vs prior)` : '';
    parts.push(`${topCat.category} leads with ${topCat.count} requests${d}.`);
  }
  const topNeigh = input.topNeighborhoods[0];
  if (topNeigh) {
    parts.push(`${topNeigh.neighborhood} shows ${topNeigh.status} pressure (${topNeigh.count} signals).`);
  }
  if (input.notableChange) {
    parts.push(`Notable: ${input.notableChange.name} ${input.notableChange.direction} ${Math.abs(input.notableChange.delta)}.`);
  }
  const evts = [...input.brightData.traffic.map((t) => t.description), ...input.brightData.digest.map((d) => d.title)];
  if (evts.length) parts.push(`Recent: ${evts[0]}.`);
  return parts.join(' ').slice(0, 500);
}

/** Cache key: window or window:district for district-specific. */
function cacheKey(window: string, district?: string): string {
  return district ? `${window}:${district}` : window;
}

/** Get cached insight if fresh. Returns { insight, generatedAt } or null. */
function getCachedInsight(key: string): { insight: string; generatedAt: string } | null {
  const row = db.prepare(`
    SELECT insight, generated_at FROM insights_cache
    WHERE time_window = ? AND datetime(generated_at) >= datetime('now', ?)
  `).get(key, `-${CACHE_TTL_MINUTES} minutes`) as { insight: string; generated_at: string } | undefined;
  return row ? { insight: row.insight, generatedAt: row.generated_at } : null;
}

/** Store insight in cache. Returns generated_at. */
function setCachedInsight(key: string, insight: string): string {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO insights_cache (time_window, generated_at, insight)
    VALUES (?, ?, ?)
    ON CONFLICT(time_window) DO UPDATE SET generated_at = excluded.generated_at, insight = excluded.insight
  `).run(key, now, insight);
  return now;
}

function toInsightProvider(mode: 'live' | 'fallback' | 'cached', provider: string): InsightProvider {
  if (mode === 'cached') {
    const p = (provider || 'fallback').toLowerCase();
    if (p === 'openai') return 'cached-openai';
    if (p === 'gemini') return 'cached-gemini';
    return 'cached-fallback';
  }
  return provider as InsightProvider;
}

/**
 * Generate civic insight for a window. Uses buildInsightInput, selected provider, fallback when needed.
 * Checks cache first; returns cached if younger than 10 minutes, preserving original provider.
 * spec: preset window (7d|30d|90d) or custom { start, end } in YYYY-MM-DD.
 */
export async function generateInsight(spec: WindowOrRange, district?: string): Promise<InsightResult> {
  const windowLabel = getInsightCacheLabel(spec);
  const key = cacheKey(windowLabel, district);
  const cached = getCachedInsight(key);
  if (cached) {
    const provider = toInsightProvider('cached', (cached as { provider?: string }).provider ?? 'fallback');
    console.log(`[AI Insight] Cache hit, provider: ${provider}`);
    return {
      window: windowLabel,
      mode: 'cached',
      provider,
      generatedAt: cached.generatedAt,
      insight: cached.insight,
    };
  }
  console.log('[AI Insight] Cache miss');

  const selection = getSelectedProvider();
  console.log(`[AI Insight] Selected provider: ${selection.provider} (AI_PROVIDER=${selection.configuredProvider})`);

  const input = buildInsightInput(spec, district);
  let insight: string;
  let mode: 'live' | 'fallback' = 'fallback';
  let usedProvider: SelectedProvider = 'fallback';
  const timeoutMs = getAiInsightTimeoutMs();

  if (selection.provider === 'openai' || selection.provider === 'gemini') {
    try {
      const prompt = buildPrompt(input);
      const result = await withTimeout(
        generateStructuredJsonWithProvider<{ insight?: string }>(
          prompt,
          selection.provider,
          { maxTokens: MAX_INSIGHT_TOKENS }
        ),
        timeoutMs,
        `AI insight ${selection.provider}`
      );
      const raw = result?.insight?.trim();
      if (raw && raw.length > 0) {
        insight = raw.split(/\s+/).slice(0, MAX_INSIGHT_WORDS).join(' ').slice(0, 500);
        mode = 'live';
        usedProvider = selection.provider;
        console.log(`[AI Insight] Live generation success, provider: ${usedProvider}`);
      } else {
        insight = buildFallbackFromInput(input);
        console.log('[AI Insight] Fallback used: live response empty');
      }
    } catch (err) {
      insight = buildFallbackFromInput(input);
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[AI Insight] Fallback used: live generation failed (${message})`);
    }
  } else {
    insight = buildFallbackFromInput(input);
    console.log('[AI Insight] Fallback used: no API key or provider unavailable');
  }

  const generatedAt = setCachedInsight(key, insight);
  return {
    window: windowLabel,
    mode,
    provider: toInsightProvider(mode, usedProvider),
    generatedAt,
    insight,
  };
}

/** @deprecated Use generateInsight. Kept for route compatibility. */
export async function generateInsightForWindow(
  window: '7d' | '30d' | '90d',
  district?: string
): Promise<{ insight: string }> {
  const result = await generateInsight(window as WindowOrRange, district);
  return { insight: result.insight };
}
