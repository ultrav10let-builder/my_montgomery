import React from 'react';
import type { CivicSignal, TrendResponse } from '../types';
import { getCategoryColor } from '../utils/categoryColors';
import { getCategoryIcon } from '../utils/mapIcons';
import { getAIInsightStatusDisplay, type AIInsightStatus, type AIInsightStatusTone } from '../utils/aiInsightStatus';
import {
  buildComparisonMovers,
  buildCurrentCategoryMix,
  formatComparisonValue,
  formatCurrentMixValue,
  getComparisonSummary,
  getCurrentMixSummary,
} from '../utils/trendInsights';

interface TrendInsightsProps {
  trends: TrendResponse | null;
  showComparison?: boolean;
  /** Display window for "Data window: X → Y" */
  dataWindowStart?: string;
  dataWindowEnd?: string;
  aiInsightStatus?: AIInsightStatus | null;
  scopeSignals?: CivicSignal[];
  previousScopeSignals?: CivicSignal[];
  scopeLabel?: string;
}

function getAIStatusClasses(tone: AIInsightStatusTone): string {
  if (tone === 'live') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300';
  if (tone === 'cached') return 'border-sky-400/30 bg-sky-500/15 text-sky-300';
  if (tone === 'fallback') return 'border-amber-400/30 bg-amber-500/15 text-amber-200';
  if (tone === 'unavailable') return 'border-rose-400/30 bg-rose-500/15 text-rose-200';
  return 'border-slate-500/30 bg-slate-800 text-slate-200';
}

export function TrendInsights({
  trends,
  showComparison,
  dataWindowStart,
  dataWindowEnd,
  aiInsightStatus,
  scopeSignals = [],
  previousScopeSignals = [],
  scopeLabel,
}: TrendInsightsProps) {
  const useComparison = Boolean(showComparison);
  const movers = useComparison ? buildComparisonMovers(scopeSignals, previousScopeSignals) : (trends?.categoryMovers ?? []);
  const currentMix = buildCurrentCategoryMix(scopeSignals);
  const displayMovers = movers.slice(0, 6);
  const displayMix = currentMix.slice(0, 6);
  const summary = useComparison
    ? getComparisonSummary(displayMovers)
    : getCurrentMixSummary(displayMix, scopeSignals.length);
  const aiStatus = getAIInsightStatusDisplay(aiInsightStatus);
  const displayItems = useComparison
    ? displayMovers.map((m) => ({
        category: m.category,
        detail: `${m.previous}→${m.current} signals`,
        value: formatComparisonValue(m),
        color: getCategoryColor(m.category),
        icon: getCategoryIcon(m.category, ''),
      }))
    : displayMix.map((item) => ({
        category: item.category,
        detail: `${item.current} signals`,
        value: formatCurrentMixValue(item),
        color: getCategoryColor(item.category),
        icon: getCategoryIcon(item.category, ''),
      }));
  const scopeText = useComparison
    ? `Scope · ${scopeLabel ?? 'Current dashboard scope'} · vs prior matched window`
    : `Scope · ${scopeLabel ?? 'Current dashboard scope'}`;

  return (
    <section className="flex flex-col gap-3 w-full" aria-label="Trend engine and data transparency">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
          {useComparison ? 'Trend Engine (vs prior)' : 'Current Activity Mix'}
        </h3>
        <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">
          {scopeText}
        </p>
        <p className="text-xs text-slate-700 mb-2 leading-snug">{summary}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {displayItems.length > 0 ? (
            displayItems.map((item) => (
              <React.Fragment key={item.category}>
                <TrendItem
                  label={item.category}
                  icon={item.icon}
                  value={item.value}
                  detail={item.detail}
                  categoryColor={item.color}
                />
              </React.Fragment>
            ))
          ) : (
            <>
              <TrendItem label="Infrastructure" icon="🚧" value="—" categoryColor="#3b82f6" />
              <TrendItem label="Sanitation" icon="🗑️" value="—" categoryColor="#22c55e" />
              <TrendItem label="Public Safety" icon="🛡️" value="—" categoryColor="#ef4444" />
            </>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 bg-slate-900 text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono">
        <span className="text-slate-300 uppercase font-semibold">Data Transparency</span>
        <span className="text-slate-300">OpenData Montgomery · GeoJSON</span>
        <span className="text-slate-300">Map shows only records with clear coordinates.</span>
        <span className={`rounded-full border px-2 py-0.5 font-semibold tracking-wide ${getAIStatusClasses(aiStatus.tone)}`}>
          {aiStatus.label}
        </span>
        {(dataWindowStart || dataWindowEnd) && (
          <span className="text-slate-300">
            Window: {dataWindowStart ?? '—'} → {dataWindowEnd ?? '—'}
          </span>
        )}
        <span className="text-slate-400">America/Chicago</span>
        {useComparison && trends?.confidenceBreakdown?.windowA && (
          <span className="text-slate-400 ml-auto">
            {trends.confidenceBreakdown.windowA.map((c) => `${c.confidence}:${c.count}`).join(', ')}
          </span>
        )}
      </div>
    </section>
  );
}

function TrendItem({
  label,
  icon,
  value,
  detail,
  categoryColor = '#64748b',
}: {
  label: string;
  icon?: string;
  value: string;
  detail?: string;
  categoryColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 shadow-md">
      {icon && <span className="text-sm leading-none" aria-hidden>{icon}</span>}
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor }} aria-hidden />
      <span className="text-xs font-medium text-slate-600 truncate">{label}</span>
      {detail && <span className="text-[10px] text-slate-500 shrink-0">{detail}</span>}
      <span className="ml-auto text-[10px] font-bold shrink-0" style={{ color: value === '—' ? '#94a3b8' : categoryColor }}>
        {value}
      </span>
    </div>
  );
}
