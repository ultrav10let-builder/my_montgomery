import React from 'react';
import { AlertCircle, TrendingUp, Map as MapIcon, Users } from 'lucide-react';
import { CityStats } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CitySnapshotProps {
  stats: CityStats | null;
}

export function CitySnapshot({ stats }: CitySnapshotProps) {
  const per10kValue = stats?.signalsPer10k != null && stats.signalsPer10k !== undefined
    ? stats.signalsPer10k.toFixed(1)
    : '—';

  return (
    <section className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="City snapshot status overview">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 shrink-0">City Snapshot</h3>
      <span className="hidden sm:inline text-slate-300">|</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 sm:gap-x-6 [&>*:first-child]:pl-0 [&>*:first-child]:border-l-0">
        <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200">
          <StripItem
            label="311 / Signals"
            value={Math.max(0, stats?.totalRequests ?? 0)}
            trend={stats?.changePercent}
            icon={<AlertCircle className="w-4 h-4 text-civic-blue" aria-hidden />}
            invertTrendColor
          />
        </div>
        <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200">
          <StripItem
            label="Per 10K"
            value={per10kValue}
            trend={stats?.signalsPer10kChange}
            icon={<Users className="w-4 h-4 text-slate-600" aria-hidden />}
            invertTrendColor
          />
        </div>
        <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200">
          <StripItem
            label="Top Category"
            value={stats?.topCategory || '—'}
            icon={<TrendingUp className="w-4 h-4 text-slate-600" aria-hidden />}
          />
        </div>
        <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200">
          <StripItem
            label="Active Area"
            value={stats?.activeNeighborhood || '—'}
            icon={<MapIcon className="w-4 h-4 text-slate-600" aria-hidden />}
          />
        </div>
      </div>
    </section>
  );
}

function StripItem({
  label,
  value,
  trend,
  invertTrendColor,
  icon,
}: {
  label: string;
  value: string | number;
  /** undefined = no trend; null = new activity (previous was 0); number = percent change */
  trend?: number | null;
  invertTrendColor?: boolean;
  icon: React.ReactNode;
}) {
  const trendColor =
    trend != null && typeof trend === 'number'
      ? invertTrendColor
        ? trend < 0 ? 'text-emerald-500' : trend > 0 ? 'text-rose-500' : 'text-slate-400'
        : trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-slate-400'
      : '';

  const trendLabel =
    trend === null ? 'new activity' : typeof trend === 'number' ? (trend > 0 ? `+${trend}%` : `${trend}%`) : null;

  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</span>
      <span className="text-sm font-bold text-slate-900 tabular-nums">{value}</span>
      {trendLabel != null && (
        <span className={cn('text-[10px] font-semibold', trend === null ? 'text-civic-blue' : trendColor)}>
          {trendLabel}
        </span>
      )}
    </div>
  );
}
