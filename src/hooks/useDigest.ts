import { useState, useEffect, useCallback } from 'react';
import { DigestResponse } from '../types';

export function useDigest(date?: string) {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    try {
      const url = date ? `/api/digest?date=${date}` : '/api/digest/today';
      const res = await fetch(url);
      const data = await res.json();
      setDigest(data);
    } catch (error) {
      console.error("Error fetching digest:", error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  return { digest, loading, refresh: fetchDigest };
}
