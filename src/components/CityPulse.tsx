import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import type { DistrictBreakdown } from '../utils/districtBreakdown';
import { signalCountToPressureScore, pressureScoreToLabel } from '../utils/pressureColors';

interface CityPulseProps {
  selectedDistrict?: string | null;
  breakdown?: DistrictBreakdown[];
  className?: string;
}

export function CityPulse({ selectedDistrict, breakdown = [], className }: CityPulseProps) {
  const pulseItems = useMemo(() => {
    const cityTotal = breakdown.reduce((s, d) => s + d.total, 0);
    const n = Math.max(breakdown.length, 1);
    return [...breakdown]
      .sort((a, b) => signalCountToPressureScore(b.total, cityTotal, n) - signalCountToPressureScore(a.total, cityTotal, n))
      .slice(0, 3)
      .map((d) => {
        const score = signalCountToPressureScore(d.total, cityTotal, n);
        const label = pressureScoreToLabel(score);
        const topIssue = d.byCategory[0]?.category ?? '—';
        let type: 'warning' | 'info' | 'success' = 'info';
        if (score > 75) type = 'warning';
        else if (score <= 25) type = 'success';
        return {
          label: `${label} pressure`,
          value: `${d.district} (${d.total} signals)`,
          detail: topIssue !== '—' ? `Top: ${topIssue}` : undefined,
          type,
        };
      });
  }, [breakdown]);

  return (
    <section 
      className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col ${className ?? ''}`}
      aria-label="City pulse and district pressure highlights"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-civic-blue" aria-hidden="true" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">City Pulse</h3>
        {selectedDistrict && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-civic-blue/90 bg-civic-blue/10 px-2 py-0.5 rounded">
            Viewing {selectedDistrict}
          </span>
        )}
      </div>
      <div className="space-y-3 flex-1">
        {pulseItems.length > 0 ? (
          pulseItems.map((item) => (
            <React.Fragment key={item.value}>
              <PulseItem
                label={item.label}
                value={item.value}
                detail={item.detail}
                type={item.type}
              />
            </React.Fragment>
          ))
        ) : (
          <p className="text-sm text-slate-600 py-2">No district signals. Data requires coordinates.</p>
        )}
      </div>
    </section>
  );
}

function PulseItem({ label, value, detail, type }: { label: string; value: string; detail?: string; type: 'warning' | 'info' | 'success' }) {
  const colors = {
    warning: 'text-rose-700 bg-rose-50 border-rose-200',
    info: 'text-civic-blue bg-blue-50/80 border-slate-200',
    success: 'text-emerald-700 bg-emerald-50 border-emerald-200'
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
      <div className={`px-3 py-2 rounded-lg text-sm font-semibold border shadow-md ${colors[type]}`}>
        <span>{value}</span>
        {detail && <span className="block text-xs font-normal opacity-90 mt-0.5">{detail}</span>}
      </div>
    </div>
  );
}
