/**
 * District Pressure Panel – visual drilldown controller for district & neighborhood.
 * Stress-based hierarchy; click to select and highlight on map.
 */

import React, { useState, useMemo } from 'react';
import { MapPin, ChevronDown, ChevronRight, Phone, Minus } from 'lucide-react';
import { CivicSignal } from '../types';
import { computeDistrictBreakdown } from '../utils/districtBreakdown';
import { pressureScoreToColor, pressureScoreToLabel, signalCountToPressureScore } from '../utils/pressureColors';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract district number for display (e.g. "District 3" → "3"). */
function districtNumber(name: string): string {
  const m = (name || '').match(/(\d+)/);
  return m ? m[1] : '';
}

/** Match Traffic category (same logic as CivicMap). */
const TRAFFIC_CATEGORY_MATCH = (cat: string): boolean => {
  const c = (cat || '').toLowerCase();
  return c === 'traffic' || c.includes('road') || c.includes('street') || c.includes('closure') ||
    c.includes('detour') || c.includes('highway') || c.includes('signal') || c.includes('traffic');
};

interface DistrictPressurePanelProps {
  signals: CivicSignal[];
  selectedDistrict: string | null;
  onDistrictSelect: (district: string | null) => void;
  /** When map is in calls mode with a category, panel uses same filtered dataset. */
  mapCategory?: string | null;
  mapMode?: 'pressure' | 'calls' | 'resources';
  className?: string;
}

export function DistrictPressurePanel({
  signals,
  selectedDistrict,
  onDistrictSelect,
  mapCategory,
  mapMode = 'calls',
  className,
}: DistrictPressurePanelProps) {
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);

  /** Use same dataset as map: calls+category = filtered, else all signals. */
  const pressureSignals = useMemo(() => {
    if (mapMode !== 'calls' || !mapCategory) return signals;
    if (mapCategory === 'Traffic') return signals.filter((s) => TRAFFIC_CATEGORY_MATCH(s.category || ''));
    return signals.filter((s) => (s.category || '').trim().toLowerCase() === mapCategory.trim().toLowerCase());
  }, [signals, mapMode, mapCategory]);

  const breakdown = useMemo(() => computeDistrictBreakdown(pressureSignals), [pressureSignals]);

  const cityTotal = pressureSignals.length;
  const districtCount = Math.max(breakdown.length, 1);

  const handleDistrictClick = (d: { district: string }) => {
    setExpandedDistrict((prev) => (prev === d.district ? null : d.district));
    onDistrictSelect(d.district);
  };

  return (
    <section className={cn('bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full', className)} aria-label="District and neighborhood pressure">
      <div className="p-3 border-b border-slate-100 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-civic-blue flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900">
              District & Neighborhood Pressure
              {mapMode === 'calls' && mapCategory && (
                <span className="ml-1.5 text-civic-blue font-medium">· {mapCategory}</span>
              )}
            </h2>
            <p className="text-[10px] text-slate-600 font-medium">
              Same dataset as map · Click to select and highlight.
            </p>
          </div>
        </div>
        {selectedDistrict && (
          <button
            type="button"
            onClick={() => onDistrictSelect(null)}
            className="text-xs font-medium text-civic-blue hover:underline text-left"
          >
            View all districts
          </button>
        )}
      </div>

      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-3 text-xs flex-wrap">
        <span className="font-medium text-slate-600">Pressure:</span>
        {[
          [0, 25, '#22c55e', 'Good'],
          [25, 50, '#eab308', 'Caution'],
          [50, 75, '#f97316', 'Attention'],
          [75, 100, '#ef4444', 'High priority']
        ].map(([lo, hi, color, label]) => (
          <span key={String(lo)} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color as string }} />
            <span>{label}</span>
          </span>
        ))}
      </div>

      <div className="overflow-y-auto max-h-[300px] p-2.5 space-y-2 lg:flex-1 lg:max-h-none">
        {breakdown.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No signals with coordinates in district boundaries. Data requires lat/lng.
          </p>
        ) : (
          [...breakdown]
            .sort((a, b) => {
              const sa = signalCountToPressureScore(a.total, cityTotal, districtCount);
              const sb = signalCountToPressureScore(b.total, cityTotal, districtCount);
              return sb - sa;
            })
            .map((d) => {
            const score = signalCountToPressureScore(d.total, cityTotal, districtCount);
            const isExpanded = expandedDistrict === d.district;
            const hasNeighborhoods = d.neighborhoods.length > 0;
            const isSelected = selectedDistrict === d.district;
            const topCategory = d.byCategory[0]?.category ?? '—';
            const stressColor = pressureScoreToColor(score);
            const stressLabel = pressureScoreToLabel(score);
            const num = districtNumber(d.district);

            return (
              <div
                key={d.district}
                className={cn(
                  "rounded-xl border overflow-hidden transition-all duration-200",
                  isSelected
                    ? "border-civic-blue border-2 ring-2 ring-civic-blue/40 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <button
                  type="button"
                  onClick={() => handleDistrictClick(d)}
                  className={cn(
                    "w-full flex items-center gap-0 text-left cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-inset",
                    "hover:bg-slate-50/80 active:bg-slate-100",
                    isExpanded && "bg-slate-50/60",
                    isSelected && "bg-civic-blue/10"
                  )}
                >
                  {/* Stress color bar – prominent left accent */}
                  <span
                    className={cn(
                      "flex-shrink-0 w-1.5 min-h-[4rem]",
                      isSelected && "w-2"
                    )}
                    style={{ backgroundColor: stressColor }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {num && (
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: stressColor }}
                            aria-hidden
                          >
                            {num}
                          </span>
                        )}
                        <p className={cn(
                          "font-bold truncate",
                          isSelected ? "text-civic-blue text-base" : "text-slate-900 text-sm"
                        )}>
                          {d.district}
                        </p>
                      </div>
                      <span
                        className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: stressColor }}
                      >
                        {stressLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums font-semibold text-slate-900">
                        {d.total} request{d.total !== 1 ? 's' : ''}
                      </span>
                      {topCategory !== '—' && (
                        <span className="text-slate-500 truncate" title={topCategory}>
                          Top: {topCategory}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pr-3 self-center">
                    <span className="text-slate-300" title="Trend (no data)">
                      <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                    {hasNeighborhoods && (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )
                    )}
                  </div>
                </button>

                {/* Category breakdown – compact pills */}
                <div className="px-3 pb-2 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {d.byCategory.map(({ category, count }) => (
                      <span
                        key={category}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700"
                      >
                        <Phone className="w-3 h-3" />
                        {category}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Neighborhood drill-down */}
                {isExpanded && hasNeighborhoods && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      By Neighborhood
                    </p>
                    {d.neighborhoods.map((n) => {
                      const nScore = signalCountToPressureScore(n.total, d.total, d.neighborhoods.length);
                      return (
                        <div
                          key={n.neighborhood}
                          className="rounded-lg border border-slate-200 bg-white p-3"
                        >
                          <p className="font-medium text-slate-900 text-sm">{n.neighborhood}</p>
                          <p className="text-xs text-slate-500 mb-2">
                            {n.total} call{n.total !== 1 ? 's' : ''} · {pressureScoreToLabel(nScore)}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {n.byCategory.map(({ category, count }) => (
                              <span
                                key={category}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-600"
                              >
                                {category}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
