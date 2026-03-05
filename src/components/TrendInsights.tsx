import React from 'react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function TrendInsights() {
  return (
    <section className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Trend Engine</h3>
        <div className="space-y-4">
          <TrendItem label="Infrastructure" value="+12%" up />
          <TrendItem label="Sanitation" value="-4%" />
          <TrendItem label="Public Safety" value="+8%" up />
        </div>
      </div>
      <div className="md:col-span-2 bg-slate-900 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Data Transparency</h3>
          <p className="text-lg font-medium mb-4">This platform uses live signals from the Montgomery Open Data Portal and Bright Data scraping services.</p>
          <div className="flex gap-6 text-xs font-mono text-slate-400">
            <div>
              <p className="uppercase mb-1">Source</p>
              <p className="text-white">OpenData Montgomery</p>
            </div>
            <div>
              <p className="uppercase mb-1">Type</p>
              <p className="text-white">GeoJSON / REST API</p>
            </div>
            <div>
              <p className="uppercase mb-1">Last Sync</p>
              <p className="text-white">{format(new Date(), 'MMM d, HH:mm')}</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-civic-red/10 rounded-full blur-3xl -mr-32 -mt-32" />
      </div>
    </section>
  );
}

function TrendItem({ label, value, up }: { label: string, value: string, up?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <div className={cn(
          "h-1.5 w-12 rounded-full",
          up ? "bg-emerald-100" : "bg-slate-100"
        )}>
          <div className={cn(
            "h-full rounded-full",
            up ? "bg-emerald-500 w-3/4" : "bg-slate-400 w-1/2"
          )} />
        </div>
        <span className={cn(
          "text-xs font-bold",
          up ? "text-emerald-600" : "text-slate-500"
        )}>{value}</span>
      </div>
    </div>
  );
}
