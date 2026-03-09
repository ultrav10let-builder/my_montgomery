import React, { useState, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AIInsightStatus } from '../utils/aiInsightStatus';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CARD_BASE = 'min-h-[6rem] rounded-2xl shadow-sm flex flex-col p-4';
const INSIGHT_REQUEST_TIMEOUT_MS = 15000;

interface InsightResponse {
  window?: string;
  mode?: 'live' | 'fallback' | 'cached';
  provider?: string;
  generatedAt?: string;
  insight?: string;
  error?: string;
}

interface AIInsightCardProps {
  window?: 'live' | '7d' | '30d' | '90d';
  customRange?: { start: string; end: string };
  selectedDistrict?: string | null;
  onRefresh?: () => void;
  onStatusChange?: (status: AIInsightStatus) => void;
}

/** Human-readable badge for mode + provider. */
function getBadgeLabel(mode: string | undefined, provider: string | undefined): string {
  if (mode === 'live') {
    if (provider === 'openai') return 'Live AI · OpenAI';
    if (provider === 'gemini') return 'Live AI · Gemini';
  }
  if (mode === 'cached') {
    if (provider === 'cached-openai') return 'Cached · OpenAI';
    if (provider === 'cached-gemini') return 'Cached · Gemini';
    if (provider === 'cached-fallback') return 'Cached · Fallback';
  }
  if (mode === 'fallback' || provider === 'fallback') return 'Fallback Insight';
  return 'AI Insight';
}

/** Lightweight parse: split insight into City Trend, District Pressure, Event Context. */
function segmentInsight(text: string): {
  cityTrend: string[];
  districtPressure: string[];
  eventContext: string[];
} {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const cityTrend: string[] = [];
  const districtPressure: string[] = [];
  const eventContext: string[] = [];
  const districtKeys = /\b(district|neighborhood|pressure|elevated|high priority|shows)\b/i;
  const eventKeys = /\b(event|recent|notable|zoning|road|closure|hearing|detour)\b/i;
  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (districtKeys.test(lower)) {
      districtPressure.push(s);
    } else if (eventKeys.test(lower)) {
      eventContext.push(s);
    } else {
      cityTrend.push(s);
    }
  }
  if (cityTrend.length === 0 && districtPressure.length === 0 && eventContext.length === 0) {
    cityTrend.push(text);
  }
  return { cityTrend, districtPressure, eventContext };
}

export function AIInsightCard({ window: timeWindow, customRange, selectedDistrict, onStatusChange }: AIInsightCardProps) {
  const [data, setData] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const districtNum = selectedDistrict
    ? selectedDistrict.replace(/\D/g, '').replace(/^0+/, '') || undefined
    : undefined;

  const fetchInsight = useCallback(async (controller: AbortController) => {
    setLoading(true);
    setError(false);
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, INSIGHT_REQUEST_TIMEOUT_MS);
    try {
      const params = new URLSearchParams();
      if (customRange) {
        params.set('start', customRange.start);
        params.set('end', customRange.end);
      } else {
        params.set('window', timeWindow ?? '7d');
      }
      if (districtNum) params.set('district', districtNum);
      const res = await fetch(`/api/insights?${params}`, { signal: controller.signal });
      const json: InsightResponse = await res.json();
      if (res.ok && (json.insight != null || json.error)) {
        setData(json);
        if (json.error) setError(true);
      } else {
        setError(true);
        setData(null);
      }
    } catch {
      if (controller.signal.aborted && !didTimeout) return;
      setError(true);
      setData(null);
    } finally {
      window.clearTimeout(timeoutId);
      if (!controller.signal.aborted || didTimeout) {
        setLoading(false);
      }
    }
  }, [timeWindow, customRange?.start, customRange?.end, districtNum]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchInsight(controller);
    return () => controller.abort();
  }, [fetchInsight]);

  const insight = data?.insight ?? '';
  const hasContent = !loading && !error && insight.length > 0;
  const segments = hasContent ? segmentInsight(insight) : null;

  useEffect(() => {
    onStatusChange?.({
      loading,
      error,
      hasContent,
      mode: data?.mode,
      provider: data?.provider,
    });
  }, [data?.mode, data?.provider, error, hasContent, loading, onStatusChange]);

  const generatedAtFormatted = data?.generatedAt
    ? (() => {
        try {
          return format(parseISO(data.generatedAt), 'MMM d, h:mm a');
        } catch {
          return data.generatedAt;
        }
      })()
    : null;

  const badgeLabel = getBadgeLabel(data?.mode, data?.provider);

  return (
    <div 
      className={cn(CARD_BASE, 'bg-civic-blue text-white border border-civic-blue/20 justify-between max-w-full')}
      role="region"
      aria-label={`AI Insight${selectedDistrict ? ` for ${selectedDistrict}` : ''}. ${loading ? 'Loading' : hasContent ? 'Content loaded' : 'No insights available'}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
          AI Insight{selectedDistrict ? ` · ${selectedDistrict}` : ''}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/20 opacity-90">
            {badgeLabel}
          </span>
          <Info className="w-4 h-4 opacity-70" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {loading && (
          <p className="text-sm leading-relaxed opacity-90">Analyzing civic signals…</p>
        )}
        {!loading && (error || !insight) && (
          <p className="text-sm leading-relaxed opacity-90">
            No insights available for this period. Try refreshing.
          </p>
        )}
        {segments && (
          <div className="space-y-2.5 text-sm leading-relaxed max-w-prose">
            {segments.cityTrend.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 block mb-0.5">
                  City Trend
                </span>
                <p className="opacity-95">{segments.cityTrend.join(' ')}</p>
              </div>
            )}
            {segments.districtPressure.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 block mb-0.5">
                  District Pressure
                </span>
                <ul className="list-disc list-inside space-y-0.5 opacity-95">
                  {segments.districtPressure.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {segments.eventContext.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 block mb-0.5">
                  Event Context
                </span>
                <ul className="list-disc list-inside space-y-0.5 opacity-95">
                  {segments.eventContext.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {generatedAtFormatted && hasContent && (
        <p className="text-[10px] opacity-75 mt-2 pt-2 border-t border-white/15">
          Generated {generatedAtFormatted}
        </p>
      )}
    </div>
  );
}
