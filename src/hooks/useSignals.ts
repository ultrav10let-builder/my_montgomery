import { useState, useEffect, useCallback } from 'react';
import { CivicSignal, CityStats, TrendResponse } from '../types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export function useSignals(mode: string = 'live', customRange?: { start: string; end: string }) {
  const [signals, setSignals] = useState<CivicSignal[]>([]);
  const [trends, setTrends] = useState<TrendResponse | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/signals/latest';
      
      if (mode !== 'live') {
        let start = '';
        let end = format(new Date(), 'yyyy-MM-dd');

        if (mode === '7d') {
          start = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        } else if (mode === '30d') {
          start = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        } else if (mode === 'custom' && customRange) {
          start = customRange.start;
          end = customRange.end;
        }

        if (start) {
          url = `/api/signals?start=${start}&end=${end}`;
        }
      }

      const res = await fetch(url);
      const signalsData: CivicSignal[] = await res.json();
      setSignals(signalsData);

      // Fetch Trends
      const window = mode === '30d' ? '30d' : '7d';
      const trendsRes = await fetch(`/api/trends?window=${window}`);
      const trendsData: TrendResponse = await trendsRes.json();
      setTrends(trendsData);

      // Get AI Summary
      const summaryRes = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: signalsData.slice(0, 20) })
      });
      const summaryData = await summaryRes.json();
      setAiSummary(summaryData.summary);
    } catch (error) {
      console.error("Error fetching signals:", error);
    } finally {
      setLoading(false);
    }
  }, [mode, customRange]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return { signals, trends, aiSummary, loading, refresh: fetchSignals };
}
