import React from 'react';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

export type TimeMode = 'live' | '7d' | '30d' | 'custom';

interface TimeControlBarProps {
  mode: TimeMode;
  onModeChange: (mode: TimeMode) => void;
  customRange?: { start: string; end: string };
  onCustomRangeChange: (start: string, end: string) => void;
  compare: boolean;
  onCompareToggle: (compare: boolean) => void;
}

export function TimeControlBar({ 
  mode, 
  onModeChange, 
  customRange, 
  onCustomRangeChange,
  compare,
  onCompareToggle
}: TimeControlBarProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-[73px] z-40">
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        {[
          { id: 'live', label: 'Live' },
          { id: '7d', label: '7 Days' },
          { id: '30d', label: '30 Days' },
          { id: 'custom', label: 'Custom' }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id as TimeMode)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === m.id 
                ? 'bg-white text-civic-blue shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-6">
        {mode === 'custom' && (
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={customRange?.start} 
              onChange={(e) => onCustomRangeChange(e.target.value, customRange?.end || '')}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-civic-blue/20"
            />
            <span className="text-slate-400">→</span>
            <input 
              type="date" 
              value={customRange?.end} 
              onChange={(e) => onCustomRangeChange(customRange?.start || '', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-civic-blue/20"
            />
          </div>
        )}

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative inline-flex items-center h-5 w-9">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={compare}
                onChange={(e) => onCompareToggle(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-civic-red"></div>
            </div>
            <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
              Compare to previous period
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
          <Clock className="w-3.5 h-3.5" />
          <span>CITY TIME: AMERICA/CHICAGO</span>
        </div>
      </div>
    </div>
  );
}
