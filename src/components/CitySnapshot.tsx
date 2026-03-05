import React from 'react';
import { AlertCircle, TrendingUp, Map as MapIcon, Info } from 'lucide-react';
import { CityStats } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CitySnapshotProps {
  stats: CityStats | null;
  aiSummary: string;
  loading: boolean;
}

export function CitySnapshot({ stats, aiSummary, loading }: CitySnapshotProps) {
  return (
    <section className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard 
        title="311 Requests (7d)" 
        value={stats?.totalRequests || 0} 
        trend={stats?.changePercent || 0}
        icon={<AlertCircle className="w-5 h-5" />}
      />
      <StatCard 
        title="Highest Category" 
        value={stats?.topCategory || "Loading..."} 
        icon={<TrendingUp className="w-5 h-5" />}
      />
      <StatCard 
        title="Most Active Area" 
        value={stats?.activeNeighborhood || "Loading..."} 
        icon={<MapIcon className="w-5 h-5" />}
      />
      <div className="bg-civic-blue text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">AI Insight</span>
          <Info className="w-4 h-4 opacity-60" />
        </div>
        <p className="text-sm leading-relaxed line-clamp-3 italic">
          {loading ? "Analyzing civic signals..." : aiSummary || "No insights available for this period."}
        </p>
      </div>
    </section>
  );
}

function StatCard({ title, value, trend, icon }: { title: string, value: string | number, trend?: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</span>
        <div className="text-slate-300">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {trend !== undefined && (
          <span className={cn(
            "text-xs font-bold",
            trend > 0 ? "text-emerald-500" : trend < 0 ? "text-rose-500" : "text-slate-400"
          )}>
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
    </div>
  );
}
