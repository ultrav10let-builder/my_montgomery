import { useCallback, useEffect, useState } from 'react';
import type { BrightDataScheduleStatus } from '../utils/systemStatus';

export function useSystemStatus() {
  const [brightDataStatus, setBrightDataStatus] = useState<BrightDataScheduleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/brightdata/status');
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        setBrightDataStatus(null);
        return;
      }
      const data = await res.json();
      setBrightDataStatus(data as BrightDataScheduleStatus);
    } catch (error) {
      console.error('Error fetching system status:', error);
      setBrightDataStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { brightDataStatus, loading, refresh: fetchStatus };
}