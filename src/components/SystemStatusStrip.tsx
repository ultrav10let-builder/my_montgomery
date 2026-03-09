import React from 'react';
import type { DigestMetadata } from '../types';
import { getAIInsightStatusDisplay, type AIInsightStatus, type AIInsightStatusTone } from '../utils/aiInsightStatus';
import {
  getBrightDataStatusBadge,
  getDigestStatusBadge,
  getSignalStatusBadge,
  type BrightDataScheduleStatus,
  type SystemStatusBadge,
  type SystemStatusTone,
} from '../utils/systemStatus';

interface SystemStatusStripProps {
  aiInsightStatus?: AIInsightStatus | null;
  brightDataStatus?: BrightDataScheduleStatus | null;
  brightDataLoading?: boolean;
  digestMetadata?: DigestMetadata | null;
  digestLoading?: boolean;
  signalsLoading?: boolean;
  signalCount: number;
}

function mapAiTone(tone: AIInsightStatusTone): SystemStatusTone {
  if (tone === 'live' || tone === 'cached') return 'good';
  if (tone === 'fallback') return 'warn';
  if (tone === 'unavailable') return 'bad';
  return 'neutral';
}

function badgeClasses(tone: SystemStatusTone): string {
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (tone === 'bad') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function StatusBadge({ badge }: { badge: SystemStatusBadge }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border px-3 py-1 ${badgeClasses(badge.tone)}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide">{badge.label}</span>
      {badge.detail && <span className="text-[10px] opacity-80">{badge.detail}</span>}
    </span>
  );
}

export function SystemStatusStrip({
  aiInsightStatus,
  brightDataStatus,
  brightDataLoading,
  digestMetadata,
  digestLoading,
  signalsLoading,
  signalCount,
}: SystemStatusStripProps) {
  const aiDisplay = getAIInsightStatusDisplay(aiInsightStatus);
  const badges: SystemStatusBadge[] = [
    { label: aiDisplay.label, tone: mapAiTone(aiDisplay.tone) },
    getBrightDataStatusBadge(brightDataStatus, brightDataLoading, digestMetadata),
    getDigestStatusBadge(digestMetadata, digestLoading),
    getSignalStatusBadge(signalCount, signalsLoading),
  ];

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-2" aria-label="System status overview">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 shrink-0">System Status</h3>
      <span className="hidden sm:inline text-slate-300">|</span>
      {badges.map((badge) => (
        <React.Fragment key={`${badge.label}-${badge.detail ?? ''}`}>
          <StatusBadge badge={badge} />
        </React.Fragment>
      ))}
    </section>
  );
}