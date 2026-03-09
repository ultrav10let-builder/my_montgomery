import { useState, useEffect, useCallback } from 'react';
import { DigestResponse } from '../types';

/** Maps display category (e.g. Traffic) to API category (lowercase: traffic). */
function toApiCategory(displayCat: string): string {
  if (displayCat === 'All') return '';
  return displayCat.toLowerCase().replace(/\s+/g, ' ');
}

export function useDigest(date?: string, category?: string) {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    try {
      const apiCat = category ? toApiCategory(category) : '';
      const baseUrl = date ? `/api/digest?date=${date}` : '/api/digest/today';
      const url = apiCat ? `${baseUrl}${date ? '&' : '?'}category=${encodeURIComponent(apiCat)}` : baseUrl;
      const res = await fetch(url);
      if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
        setDigest(null);
        return;
      }
      const data = await res.json();
      setDigest(data);
    } catch (error) {
      console.error("Error fetching digest:", error);
      setDigest(null);
    } finally {
      setLoading(false);
    }
  }, [date, category]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  // Poll every 5 min for real-time digest updates (aligned with Bright Data schedule)
  useEffect(() => {
    if (date) return; // No polling for historical dates
    const interval = setInterval(fetchDigest, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [date, fetchDigest]);

  return { digest, loading, refresh: fetchDigest };
}
