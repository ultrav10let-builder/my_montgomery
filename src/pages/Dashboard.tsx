import React, { useState } from 'react';
import { Activity, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useSignals } from '../hooks/useSignals';
import { useDigest } from '../hooks/useDigest';
import { CitySnapshot } from '../components/CitySnapshot';
import { CivicMap } from '../components/CivicMap';
import { CivicDigest } from '../components/CivicDigest';
import { TrendInsights } from '../components/TrendInsights';
import { CityPulse } from '../components/CityPulse';
import { TimeControlBar, TimeMode } from '../components/TimeControlBar';

export function Dashboard() {
  const [timeMode, setTimeMode] = useState<TimeMode>('live');
  const [customRange, setCustomRange] = useState({ 
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), 
    end: format(new Date(), 'yyyy-MM-dd') 
  });
  const [compare, setCompare] = useState(false);

  const { signals, trends, aiSummary, loading: signalsLoading, refresh: refreshSignals } = useSignals(timeMode, customRange);
  const { digest, loading: digestLoading, refresh: refreshDigest } = useDigest(timeMode === 'custom' ? customRange.start : undefined);

  const handleRefresh = () => {
    refreshSignals();
    refreshDigest();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-civic-red p-2 rounded-lg">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-civic-blue">My❤️Montgomery</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Your City. Clearly Seen.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 font-mono">LAST UPDATED</p>
            <p className="text-sm font-medium">{format(new Date(), 'h:mm a')}</p>
          </div>
          <button 
            onClick={handleRefresh}
            className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
          >
            <Clock className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </header>

      <TimeControlBar 
        mode={timeMode}
        onModeChange={setTimeMode}
        customRange={customRange}
        onCustomRangeChange={(start, end) => setCustomRange({ start, end })}
        compare={compare}
        onCompareToggle={setCompare}
      />

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <CitySnapshot 
          stats={trends ? {
            totalRequests: trends.windowA.stats.total,
            changePercent: trends.overallPercentChange,
            topCategory: trends.windowA.stats.byCategory[0]?.category || 'N/A',
            activeNeighborhood: trends.windowA.stats.byNeighborhood[0]?.neighborhood || 'N/A'
          } : null} 
          aiSummary={aiSummary} 
          loading={signalsLoading} 
        />
        
        <CivicMap signals={signals} />
        
        <aside className="lg:col-span-1 flex flex-col gap-6">
          <CityPulse />
          <CivicDigest digest={digest?.items || []} loading={digestLoading} metadata={digest?.metadata} />
        </aside>

        <TrendInsights trends={trends} showComparison={compare} />
      </main>

      <footer className="bg-white border-t border-slate-200 p-6 text-center">
        <p className="text-xs text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} My❤️Montgomery. Built for civic transparency.
        </p>
      </footer>
    </div>
  );
}
