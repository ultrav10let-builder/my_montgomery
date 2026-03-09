import React from 'react';
import { Clock } from 'lucide-react';

export type TimeMode = 'live' | '7d' | '30d' | '90d' | 'custom';

interface TimeControlBarProps {
  mode: TimeMode;
  onModeChange: (mode: TimeMode) => void;
  customRange?: { start: string; end: string };
  onCustomRangeChange: (start: string, end: string) => void;
  compare: boolean;
  onCompareToggle: (compare: boolean) => void;
}

const TIME_MODES: { id: TimeMode; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
];

export function TimeControlBar({
  mode,
  onModeChange,
  customRange,
  onCustomRangeChange,
  compare,
  onCompareToggle,
}: TimeControlBarProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm border-b border-sky-100 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-[73px] z-40 shadow-sm" role="group" aria-label="Time range controls">
      {/* Mode pills */}
      <div className="flex items-center gap-0.5 bg-white/80 border border-sky-100 p-1 rounded-lg shadow-sm" role="group" aria-label="Select data time range">
        {TIME_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            aria-pressed={mode === m.id}
            aria-label={`View data for ${m.label}`}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2 ${
              mode === m.id
                ? 'bg-white text-civic-blue shadow-sm border border-sky-100'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Right side: custom range inputs, compare toggle, city time badge */}
      <div className="flex items-center gap-4 flex-wrap">
        {mode === 'custom' && (
          <div className="flex items-center gap-2" role="group" aria-label="Custom date range">
            <label htmlFor="date-start" className="sr-only">Start date</label>
            <input
              type="date"
              id="date-start"
              value={customRange?.start}
              onChange={(e) => onCustomRangeChange(e.target.value, customRange?.end || '')}
              aria-label="Start date"
              className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:ring-2 focus:ring-civic-blue focus:border-civic-blue"
            />
            <span className="text-slate-600 text-sm" aria-hidden>→</span>
            <label htmlFor="date-end" className="sr-only">End date</label>
            <input
              type="date"
              id="date-end"
              value={customRange?.end}
              onChange={(e) => onCustomRangeChange(customRange?.start || '', e.target.value)}
              aria-label="End date"
              className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:ring-2 focus:ring-civic-blue focus:border-civic-blue"
            />
          </div>
        )}

        <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div className="relative inline-flex items-center h-5 w-9 flex-shrink-0">
              <input
                id="compare-toggle"
                type="checkbox"
                className="sr-only peer"
                checked={compare}
                role="switch"
                aria-checked={compare}
                aria-label="Compare to previous period"
                onChange={(e) => onCompareToggle(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-200 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-civic-blue peer-focus-visible:ring-offset-2 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-civic-red" />
            </div>
            <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors whitespace-nowrap">
              Compare to previous period
            </span>
          </label>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-white/85 px-3 py-1.5 rounded-md border border-sky-100 shadow-sm flex-shrink-0" role="status" aria-label="City timezone">
            <Clock className="w-3.5 h-3.5" aria-hidden />
            <span>CITY TIME: AMERICA/CHICAGO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
