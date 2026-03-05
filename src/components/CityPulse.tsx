import React from 'react';
import { Activity } from 'lucide-react';

export function CityPulse() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-civic-blue" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">City Pulse</h3>
      </div>
      <div className="space-y-4">
        <PulseItem 
          label="Rising pressure" 
          value="West Montgomery (+18%)" 
          type="warning" 
        />
        <PulseItem 
          label="Persistent pressure" 
          value="North District" 
          type="info" 
        />
        <PulseItem 
          label="Improving" 
          value="Downtown" 
          type="success" 
        />
      </div>
    </div>
  );
}

function PulseItem({ label, value, type }: { label: string, value: string, type: 'warning' | 'info' | 'success' }) {
  const colors = {
    warning: 'text-rose-600 bg-rose-50',
    info: 'text-civic-blue bg-blue-50',
    success: 'text-emerald-600 bg-emerald-50'
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <div className={`px-3 py-2 rounded-lg text-sm font-semibold ${colors[type]}`}>
        {value}
      </div>
    </div>
  );
}
