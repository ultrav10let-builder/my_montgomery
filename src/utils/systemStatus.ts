import type { DigestMetadata } from '../types';
import { safeFormat } from './dateUtils';

export type SystemStatusTone = 'neutral' | 'good' | 'warn' | 'bad';

export interface SystemStatusBadge {
  label: string;
  detail?: string;
  tone: SystemStatusTone;
}

export interface BrightDataScheduleStatus {
  configured: boolean;
  intervalMinutes: number;
  lastTrafficRun: string | null;
  lastDigestRun: string | null;
  lastTrafficError: string | null;
  lastDigestError: string | null;
}

function formatStatusTimestamp(value: string | null | undefined): string | null {
  const formatted = safeFormat(value, 'MMM d, h:mm a');
  return formatted === 'N/A' || formatted === 'Invalid Date' ? null : formatted;
}

export function getBrightDataStatusBadge(
  status?: BrightDataScheduleStatus | null,
  loading = false,
  digestMetadata?: DigestMetadata | null,
): SystemStatusBadge {
  if (loading && !status) return { label: 'Bright Data: Checking', tone: 'neutral' };
  if (!status) return { label: 'Bright Data: Status unavailable', tone: 'warn' };

  const cachedDigestAt = formatStatusTimestamp(digestMetadata?.event_at);

  if (status.lastTrafficError || status.lastDigestError) {
    if (status.lastTrafficError && status.lastDigestError) {
      return {
        label: 'Bright Data: Refresh delayed',
        detail: cachedDigestAt
          ? `Traffic retry pending · cached digest from ${cachedDigestAt}`
          : 'Traffic and digest retries pending',
        tone: 'warn',
      };
    }

    if (status.lastTrafficError) {
      return {
        label: 'Bright Data: Traffic refresh delayed',
        detail: 'Awaiting next successful traffic scrape',
        tone: 'warn',
      };
    }

    return cachedDigestAt
      ? {
          label: `Bright Data: Scheduled · ${status.intervalMinutes}m`,
          detail: `Showing cached real digest · last update ${cachedDigestAt}`,
          tone: 'warn',
        }
      : {
          label: 'Bright Data: Digest refresh delayed',
          detail: 'Awaiting next successful digest scrape',
          tone: 'warn',
        };
  }

  if (!status.configured) {
    return {
      label: 'Bright Data: Auto refresh off',
      detail: 'Scheduler disabled or credentials missing',
      tone: 'warn',
    };
  }

  const trafficAt = formatStatusTimestamp(status.lastTrafficRun);
  const digestAt = formatStatusTimestamp(status.lastDigestRun);
  if (trafficAt || digestAt) {
    const parts = [trafficAt ? `Traffic ${trafficAt}` : null, digestAt ? `Digest ${digestAt}` : null].filter(Boolean);
    return {
      label: `Bright Data: Scheduled · ${status.intervalMinutes}m`,
      detail: parts.join(' · '),
      tone: 'good',
    };
  }

  return {
    label: `Bright Data: Scheduled · ${status.intervalMinutes}m`,
    detail: 'Awaiting first successful run',
    tone: 'neutral',
  };
}

export function getDigestStatusBadge(metadata?: DigestMetadata | null, loading = false): SystemStatusBadge {
  if (loading && !metadata?.event_at) return { label: 'Digest: Checking', tone: 'neutral' };

  const updatedAt = formatStatusTimestamp(metadata?.event_at);
  const ingestedAt = formatStatusTimestamp(metadata?.ingested_at);
  if (updatedAt) {
    return {
      label: 'Digest: Updated',
      detail: ingestedAt ? `${updatedAt} · ingested ${ingestedAt}` : updatedAt,
      tone: 'good',
    };
  }

  return {
    label: 'Digest: Awaiting update',
    detail: 'No current digest metadata',
    tone: 'neutral',
  };
}

export function getSignalStatusBadge(total: number, loading = false): SystemStatusBadge {
  if (loading) {
    return { label: 'Signals: Syncing', detail: 'Loading current dashboard scope', tone: 'neutral' };
  }

  return {
    label: `Signals: ${Math.max(0, total)} loaded`,
    detail: 'Current dashboard scope',
    tone: total > 0 ? 'good' : 'neutral',
  };
}