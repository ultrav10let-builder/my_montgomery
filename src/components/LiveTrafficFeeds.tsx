import React from 'react';
import { Car, RefreshCw } from 'lucide-react';
import { useTrafficFeeds } from '../hooks/useTrafficFeeds';
import { formatDistanceToNow } from 'date-fns';

interface LiveTrafficFeedsProps {
  onAdminRefresh?: (token: string) => void;
}

function getMergeConfidenceLabel(confidence?: number): string | null {
  if (typeof confidence !== 'number' || confidence <= 0) return null;
  if (confidence >= 0.85) return 'Strong match';
  if (confidence >= 0.7) return 'Likely same event';
  return 'Possible cross-source match';
}

export function LiveTrafficFeeds({ onAdminRefresh }: LiveTrafficFeedsProps) {
  const { feeds, loading, refresh } = useTrafficFeeds(true);

  const handleAdminRefresh = async () => {
    if (!onAdminRefresh) return;
    const token = localStorage.getItem('admin_token');
    const t = token || prompt('Enter Admin Token:');
    if (t) {
      if (!token) localStorage.setItem('admin_token', t);
      await onAdminRefresh(t);
      setTimeout(refresh, 5000);
    }
  };

  return (
    <section 
      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"
      aria-label="Live traffic feeds and incidents"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-amber-600" aria-hidden="true" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Live Traffic</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-civic-blue hover:underline disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Refresh'}
          </button>
          {onAdminRefresh && (
            <button
              onClick={handleAdminRefresh}
              className="p-1 hover:bg-slate-100 rounded"
              title="Pull live traffic via Bright Data (Admin)"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {loading && feeds.length === 0 ? (
          <p className="text-sm text-slate-600">Loading traffic feeds…</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-slate-600">
            No traffic incidents. {onAdminRefresh && (
              <>
                <button 
                  onClick={handleAdminRefresh} 
                  className="text-civic-blue hover:underline font-medium focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2 rounded"
                  aria-label="Click to pull live feeds from ALDOT 511 via Bright Data"
                >
                  Click Refresh (Admin)
                </button>
                {' '}to pull live feeds from ALDOT 511 via Bright Data.
              </>
            )}
          </p>
        ) : (
          feeds.slice(0, 5).map((feed) => (
            <div
              key={feed.id}
              className="border-l-2 border-amber-500 pl-3 py-2 bg-white/90 rounded-r-xl border border-amber-100 shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                {feed.road ? (
                  <span className="text-xs font-semibold text-slate-600 uppercase">{feed.road}</span>
                ) : <span />}
                {typeof feed.merged_report_count === 'number' && feed.merged_report_count > 1 && (
                  <span
                    className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                    title={feed.dedupe_reason && typeof feed.dedupe_confidence === 'number'
                      ? `${feed.dedupe_reason} • ${Math.round(feed.dedupe_confidence * 100)}% confidence`
                      : 'Merged similar reports'}
                  >
                    Merged {feed.merged_report_count} reports
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-0.5">{feed.description}</p>
              {typeof feed.merged_report_count === 'number' && feed.merged_report_count > 1 && (
                <p className="mt-1 text-[10px] text-amber-700">
                  {feed.merged_source_count ?? 1} sources aligned
                  {getMergeConfidenceLabel(feed.dedupe_confidence) ? ` · ${getMergeConfidenceLabel(feed.dedupe_confidence)}` : ''}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                {feed.source_label} · {formatDistanceToNow(new Date(feed.ingested_at_utc), { addSuffix: true })}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
