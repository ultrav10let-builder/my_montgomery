/**
 * Tracks last Bright Data scrape times for schedule verification.
 * Updated by server.ts when the 5-minute scheduler runs.
 */

let lastTrafficRun: string | null = null;
let lastDigestRun: string | null = null;
let lastTrafficError: string | null = null;
let lastDigestError: string | null = null;

export function setLastTrafficRun(ok: boolean = true, error?: string): void {
  lastTrafficRun = new Date().toISOString();
  lastTrafficError = ok ? null : (error ?? 'Unknown error');
}

export function setLastDigestRun(ok: boolean = true, error?: string): void {
  lastDigestRun = new Date().toISOString();
  lastDigestError = ok ? null : (error ?? 'Unknown error');
}

export function getBrightDataScheduleStatus(): {
  configured: boolean;
  intervalMinutes: number;
  lastTrafficRun: string | null;
  lastDigestRun: string | null;
  lastTrafficError: string | null;
  lastDigestError: string | null;
} {
  const interval = parseInt(process.env.BRIGHTDATA_INTERVAL_MINUTES || '5', 10);
  return {
    configured: !!process.env.BRIGHTDATA_BROWSER_WSS && interval > 0,
    intervalMinutes: interval,
    lastTrafficRun,
    lastDigestRun,
    lastTrafficError,
    lastDigestError,
  };
}
