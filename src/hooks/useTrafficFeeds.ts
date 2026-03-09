import { useState, useEffect, useCallback } from 'react';

export interface TrafficFeedItem {
  id: string;
  source_url: string;
  source_label: string;
  road?: string;
  direction?: string;
  description: string;
  severity?: string;
  latitude?: number;
  longitude?: number;
  ingested_at_utc: string;
  dedupe_confidence?: number;
  dedupe_reason?: 'same-road-overlap' | 'same-road-near-match' | 'same-city-high-overlap' | 'same-city-fatal-crash';
  merged_report_count?: number;
  merged_source_count?: number;
  suppressed_duplicate_count?: number;
}

export function useTrafficFeeds(live = false) {
  const [feeds, setFeeds] = useState<TrafficFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const url = live ? '/api/traffic/feeds?live=1' : '/api/traffic/feeds';
      const res = await fetch(url);
      const data = await res.json();
      setFeeds(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching traffic feeds:', error);
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    fetchFeeds();
    const interval = setInterval(fetchFeeds, 5 * 60 * 1000); // poll every 5 min
    return () => clearInterval(interval);
  }, [fetchFeeds]);

  return { feeds, loading, refresh: fetchFeeds };
}
