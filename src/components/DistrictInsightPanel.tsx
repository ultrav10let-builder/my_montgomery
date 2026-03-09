import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, MapPinned, Minus, TrendingUp } from 'lucide-react';
import type { CivicSignal } from '../types';
import type { MapMode } from './CivicMap';
import type { TimeMode } from './TimeControlBar';
import { buildDistrictInsight } from '../utils/districtInsights';

interface DistrictInsightPanelProps {
  district?: string | null;
  scopeSignals: CivicSignal[];
  comparisonScopeSignals?: CivicSignal[];
  previousScopeSignals?: CivicSignal[];
  mapCategory?: string | null;
  mapMode?: MapMode;
  timeMode: TimeMode;
  loading?: boolean;
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function DistrictInsightPanel({
  district,
  scopeSignals,
  comparisonScopeSignals = scopeSignals,
  previousScopeSignals,
  mapCategory,
  mapMode = 'pressure',
  timeMode,
  loading = false,
}: DistrictInsightPanelProps) {
  const hasDistrict = Boolean(district);
  const insight = useMemo(
    () => (district
      ? buildDistrictInsight({ district, scopeSignals, comparisonScopeSignals, previousScopeSignals })
      : null),
    [comparisonScopeSignals, district, previousScopeSignals, scopeSignals],
  );

  const scopeLabel = mapMode === 'resources'
    ? 'Resource view · signal context'
    : `${mapCategory ?? 'All categories'} · ${mapMode === 'calls' ? 'Calls view' : 'Pressure view'}`;
  const showsHistoricalTrendNote = hasDistrict && timeMode === 'live' && previousScopeSignals !== undefined;
  const changeTone = !insight || insight.changeAbsolute == null
    ? 'text-slate-500'
    : insight.changeAbsolute > 0
      ? 'text-amber-700'
      : insight.changeAbsolute < 0
        ? 'text-emerald-700'
        : 'text-slate-600';
  const priorWindowValue = !insight
    ? '—'
    : loading
    ? '—'
    : insight.changeAbsolute == null
      ? '—'
      : insight.changePercent === null
        ? `+${insight.changeAbsolute} new`
        : formatSignedPercent(insight.changePercent);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" aria-label="District insight panel">
      <div className="p-4 border-b border-slate-100 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <MapPinned className="w-5 h-5 text-civic-blue flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">District Insight · {hasDistrict ? district : 'Select a district'}</h2>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Map-synced scope · {scopeLabel}</p>
          </div>
        </div>
        {showsHistoricalTrendNote && (
          <p className="text-xs text-slate-600">
            Live count reflects active signals; prior-window change uses matched 7-day history.
          </p>
        )}
        {!hasDistrict && (
          <p className="text-xs text-slate-600">
            Choose a district on the map to see scoped rates, top issue, and neighborhood activity.
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InsightStat
            label="Current scoped signals"
            value={insight ? `${insight.currentTotal}` : '—'}
            detail={insight ? 'Mapped records in this district' : 'Select a district to see mapped records in this district'}
          />
          <InsightStat
            label="Approx signals per 10k"
            value={insight ? insight.signalsPer10kApprox.toFixed(1) : '—'}
            detail={
              insight
                ? 'Uses even district population share until district census splits are added'
                : 'Per-capita context appears after you select a district'
            }
          />
          <InsightStat
            label="Vs citywide rate"
            value={insight ? formatSignedPercent(insight.vsCityRatePercent) : '—'}
            detail={
              insight
                ? `${insight.citySignalsPer10k.toFixed(1)} citywide signals per 10k in this scope`
                : 'Citywide comparison appears after you select a district'
            }
            valueClassName={
              insight
                ? insight.vsCityRatePercent > 0
                  ? 'text-amber-700'
                  : insight.vsCityRatePercent < 0
                    ? 'text-emerald-700'
                    : undefined
                : undefined
            }
          />
          <InsightStat
            label="Prior matched window"
            value={priorWindowValue}
            detail={
              !insight
                ? 'Choose a district to compare this scope with the matched prior window'
                : loading
                ? 'Refreshing matched-window context…'
                : `${insight.previousTotal} → ${insight.comparisonCurrentTotal} signals for trend context`
            }
            valueClassName={changeTone}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-3">
          <div className="rounded-xl border border-slate-200 p-3 bg-white/85 shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Dominant issue</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{insight?.topCategory ?? '—'}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {insight
                    ? `${insight.topCategoryCount} signal${insight.topCategoryCount === 1 ? '' : 's'} · ${insight.topCategoryShare.toFixed(1)}% of district activity`
                    : 'Select a district to see the leading mapped issue in this scope'}
                </p>
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${insight ? 'text-civic-blue' : 'text-slate-400'}`}>
                <TrendingUp className="w-4 h-4" />
                {insight ? `${insight.shareOfScopedSignals.toFixed(1)}% of scoped city signals` : 'Waiting for district selection'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 bg-white/85 shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Leading neighborhoods</p>
            <div className="space-y-2">
              {insight && insight.topNeighborhoods.length > 0 ? (
                insight.topNeighborhoods.map((item) => (
                  <div key={item.neighborhood} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2 shadow-md">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.neighborhood}</p>
                      <p className="text-xs text-slate-500">{item.share.toFixed(1)}% of district activity</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{item.total} signals</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {insight
                    ? 'No mapped neighborhood activity in the current scope.'
                    : 'Select a district to see neighborhood activity in the current scope.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InsightStat({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string;
  detail: string;
  valueClassName?: string;
}) {
  const TrendIcon = value.startsWith('+') ? ArrowUpRight : value.startsWith('-') ? ArrowDownRight : Minus;

  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white shadow-md">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <TrendIcon className={`w-4 h-4 ${valueClassName ?? 'text-slate-500'}`} />
        <p className={`text-lg font-semibold text-slate-900 ${valueClassName ?? ''}`}>{value}</p>
      </div>
      <p className="mt-1 text-xs text-slate-600 leading-snug">{detail}</p>
    </div>
  );
}