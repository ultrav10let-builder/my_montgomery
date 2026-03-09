import { useState, useEffect, useCallback } from 'react';
import type { CivicSignal, TrendResponse } from '../types';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';

type SignalMode = 'live' | '7d' | '30d' | '90d' | 'custom';

interface SignalRange {
  start: string;
  end: string;
  activeOnly?: boolean;
}

function getPresetStart(days: number): string {
  return format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
}

function buildSignalsUrl(mode: SignalMode, customRange?: { start: string; end: string }): string {
  const today = format(new Date(), 'yyyy-MM-dd');

  if (mode === 'live') {
    return `/api/signals?start=${getPresetStart(7)}&end=${today}&active_only=1`;
  }

  if (mode === '7d') {
    return `/api/signals?start=${getPresetStart(7)}&end=${today}`;
  }

  if (mode === '30d') {
    return `/api/signals?start=${getPresetStart(30)}&end=${today}`;
  }

  if (mode === '90d') {
    return `/api/signals?start=${getPresetStart(90)}&end=${today}`;
  }

  if (mode === 'custom' && customRange?.start && customRange?.end) {
    return `/api/signals?start=${customRange.start}&end=${customRange.end}`;
  }

  return '/api/signals/latest';
}

function buildSignalsUrlForRange(range: SignalRange): string {
  const params = new URLSearchParams({ start: range.start, end: range.end });
  if (range.activeOnly) params.set('active_only', '1');
  return `/api/signals?${params.toString()}`;
}

function getCurrentSignalRange(
  mode: SignalMode,
  customRange?: { start: string; end: string },
  options?: { forComparison?: boolean },
): SignalRange {
  const today = format(new Date(), 'yyyy-MM-dd');

  if (mode === 'live') {
    return {
      start: getPresetStart(7),
      end: today,
      activeOnly: options?.forComparison ? false : true,
    };
  }

  if (mode === '7d') return { start: getPresetStart(7), end: today };
  if (mode === '30d') return { start: getPresetStart(30), end: today };
  if (mode === '90d') return { start: getPresetStart(90), end: today };

  if (mode === 'custom' && customRange?.start && customRange?.end) {
    return { start: customRange.start, end: customRange.end };
  }

  return { start: getPresetStart(7), end: today };
}

function getPreviousSignalRange(mode: SignalMode, customRange?: { start: string; end: string }): SignalRange {
  const currentRange = getCurrentSignalRange(mode, customRange, { forComparison: true });
  const spanDays = differenceInCalendarDays(parseISO(currentRange.end), parseISO(currentRange.start)) + 1;

  return {
    start: format(subDays(parseISO(currentRange.start), Math.max(spanDays, 1)), 'yyyy-MM-dd'),
    end: format(subDays(parseISO(currentRange.start), 1), 'yyyy-MM-dd'),
  };
}

function buildTrendsUrl(mode: SignalMode, customRange?: { start: string; end: string }): string {
  if (mode === 'custom' && customRange?.start && customRange?.end) {
    return `/api/trends?start=${customRange.start}&end=${customRange.end}`;
  }

  const window = mode === '90d' ? '90d' : mode === '30d' ? '30d' : '7d';
  return `/api/trends?window=${window}`;
}

export function useSignals(
  mode: SignalMode = 'live',
  customRange?: { start: string; end: string },
  includeComparison = false,
) {
  const [signals, setSignals] = useState<CivicSignal[]>([]);
  const [comparisonSignals, setComparisonSignals] = useState<CivicSignal[]>([]);
  const [previousSignals, setPreviousSignals] = useState<CivicSignal[]>([]);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const currentUrl = buildSignalsUrl(mode, customRange);
      const trendsUrl = buildTrendsUrl(mode, customRange);
      const compareCurrentUrl = includeComparison && mode === 'live'
        ? buildSignalsUrlForRange(getCurrentSignalRange(mode, customRange, { forComparison: true }))
        : null;
      const previousUrl = includeComparison
        ? buildSignalsUrlForRange(getPreviousSignalRange(mode, customRange))
        : null;

      const [res, trendsRes, compareRes, previousRes] = await Promise.all([
        fetch(currentUrl),
        fetch(trendsUrl),
        compareCurrentUrl ? fetch(compareCurrentUrl) : Promise.resolve(null),
        previousUrl ? fetch(previousUrl) : Promise.resolve(null),
      ]);

      if (!res.ok) {
        const text = await res.text();
        console.error(`Signals API error ${res.status}:`, text.slice(0, 200));
        throw new Error(`API ${res.status}. Ensure server is running at http://localhost:8080`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("API returned non-JSON (wrong port?). Use http://localhost:8080");
      }
      const data = await res.json();
      const signalsData = Array.isArray(data) ? data : [];
      setSignals(signalsData);

      if (compareRes?.ok && compareRes.headers.get("content-type")?.includes("application/json")) {
        const compareData = await compareRes.json();
        setComparisonSignals(Array.isArray(compareData) ? compareData : []);
      } else {
        setComparisonSignals(signalsData);
      }

      if (previousRes?.ok && previousRes.headers.get("content-type")?.includes("application/json")) {
        const previousData = await previousRes.json();
        setPreviousSignals(Array.isArray(previousData) ? previousData : []);
      } else {
        setPreviousSignals([]);
      }

      if (trendsRes.ok && trendsRes.headers.get("content-type")?.includes("application/json")) {
        const trendsData: TrendResponse = await trendsRes.json();
        setTrends(trendsData);
      } else {
        setTrends(null);
      }
    } catch (error) {
      console.error("Error fetching signals:", error);
      setPreviousSignals([]);
    } finally {
      setLoading(false);
    }
  }, [customRange, includeComparison, mode]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return { signals, comparisonSignals, previousSignals, trends, loading, refresh: fetchSignals };
}
