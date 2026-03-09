import React, { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { useSignals } from '../hooks/useSignals';
import { useDigest } from '../hooks/useDigest';
import { CitySnapshot } from '../components/CitySnapshot';
import { CivicMap, type MapMode } from '../components/CivicMap';
import { AIInsightCard } from '../components/AIInsightCard';
import { DistrictInsightPanel } from '../components/DistrictInsightPanel';
import { DistrictPressurePanel } from '../components/DistrictPressurePanel';
import { CivicDigest } from '../components/CivicDigest';
import { SystemStatusStrip } from '../components/SystemStatusStrip';
import { TrendInsights } from '../components/TrendInsights';
import { CityPulse } from '../components/CityPulse';
import { LiveTrafficFeeds } from '../components/LiveTrafficFeeds';
import { TimeControlBar, TimeMode } from '../components/TimeControlBar';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { buildCityWideSnapshotStats, buildDistrictSnapshotFromSignals } from '../utils/citySnapshot';
import { scopeSignalsToMapSelection } from '../utils/civicMapFilters';
import { computeDistrictBreakdown } from '../utils/districtBreakdown';
import type { AIInsightStatus } from '../utils/aiInsightStatus';

export function Dashboard() {
  const [timeMode, setTimeMode] = useState<TimeMode>('live');
  const [customRange, setCustomRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [compare, setCompare] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [digestCategory, setDigestCategory] = useState<string>('All');
  const [mapCategory, setMapCategory] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('pressure');
  const [aiInsightStatus, setAiInsightStatus] = useState<AIInsightStatus>({
    loading: true,
    error: false,
    hasContent: false,
  });

  const {
    signals,
    comparisonSignals,
    previousSignals,
    trends,
    loading: signalsLoading,
    refresh: refreshSignals,
  } = useSignals(timeMode, customRange, compare || Boolean(selectedDistrict));
  const { digest, loading: digestLoading, refresh: refreshDigest } = useDigest(
    timeMode === 'custom' ? customRange.start : undefined,
    digestCategory
  );
  const {
    brightDataStatus,
    loading: systemStatusLoading,
    refresh: refreshSystemStatus,
  } = useSystemStatus();

  const handleRefresh = () => {
    refreshSignals();
    refreshDigest();
    refreshSystemStatus();
  };

  const breakdown = useMemo(() => computeDistrictBreakdown(signals), [signals]);

  const currentDistrictScopeSignals = useMemo(() => scopeSignalsToMapSelection(signals, {
    selectedDistrict,
    selectedCategory: mapCategory,
    mapMode,
  }), [mapCategory, mapMode, selectedDistrict, signals]);

  const districtInsightComparisonSignals = useMemo(() => {
    const baseSignals = timeMode === 'live' ? comparisonSignals : signals;

    return scopeSignalsToMapSelection(baseSignals, {
      selectedDistrict,
      selectedCategory: mapCategory,
      mapMode,
    });
  }, [comparisonSignals, mapCategory, mapMode, selectedDistrict, signals, timeMode]);

  const districtInsightPreviousSignals = useMemo(() => scopeSignalsToMapSelection(previousSignals, {
    selectedDistrict,
    selectedCategory: mapCategory,
    mapMode,
  }), [mapCategory, mapMode, previousSignals, selectedDistrict]);

  const districtSnapshotStats = useMemo(() => {
    if (!selectedDistrict) return null;

    return buildDistrictSnapshotFromSignals(currentDistrictScopeSignals) ?? {
      totalRequests: 0,
      topCategory: 'N/A',
      activeNeighborhood: 'N/A',
      signalsPer10k: 0,
    };
  }, [currentDistrictScopeSignals, selectedDistrict]);

  const snapshotStats = useMemo(() => {
    if (selectedDistrict) {
      return districtSnapshotStats;
    }

    return buildCityWideSnapshotStats(signals, trends);
  }, [districtSnapshotStats, selectedDistrict, signals, trends]);

  const comparisonBaseSignals = useMemo(() => {
    if (compare && timeMode === 'live') {
      return comparisonSignals;
    }

    return signals;
  }, [compare, comparisonSignals, signals, timeMode]);

  const trendScopeSignals = useMemo(() => {
    return scopeSignalsToMapSelection(comparisonBaseSignals, {
      selectedDistrict,
      selectedCategory: mapCategory,
      mapMode,
    });
  }, [comparisonBaseSignals, mapCategory, mapMode, selectedDistrict]);

  const previousTrendScopeSignals = useMemo(() => {
    return scopeSignalsToMapSelection(previousSignals, {
      selectedDistrict,
      selectedCategory: mapCategory,
      mapMode,
    });
  }, [mapCategory, mapMode, previousSignals, selectedDistrict]);

  const trendScopeLabel = useMemo(() => {
    const parts = [selectedDistrict ?? 'Citywide'];

    if (mapMode === 'resources') {
      parts.push('Resource view');
      parts.push('Signal context');
    } else {
      parts.push(mapCategory ?? 'All categories');
      parts.push(mapMode === 'calls' ? 'Calls view' : 'Pressure view');
    }

    if (compare && timeMode === 'live') {
      parts.push('7-day history compare');
    }

    return parts.join(' · ');
  }, [compare, mapCategory, mapMode, selectedDistrict, timeMode]);

  const timeWindowStartLabel = timeMode === 'custom'
    ? format(parseISO(customRange.start), 'MMM d, yyyy')
    : timeMode === '7d'
      ? format(subDays(new Date(), 6), 'MMM d, yyyy')
      : timeMode === '30d'
        ? format(subDays(new Date(), 29), 'MMM d, yyyy')
        : timeMode === '90d'
          ? format(subDays(new Date(), 89), 'MMM d, yyyy')
          : format(subDays(new Date(), 6), 'MMM d, yyyy');

  const timeWindowEndLabel = timeMode === 'custom'
    ? format(parseISO(customRange.end), 'MMM d, yyyy')
    : format(new Date(), 'MMM d, yyyy');

  const mapTimeLabel = timeMode === 'custom'
    ? `${format(parseISO(customRange.start), 'MMM d')} → ${format(parseISO(customRange.end), 'MMM d')}`
    : timeMode === 'live'
      ? 'Live · last 7 days'
      : timeMode === '7d'
        ? '7 days'
        : timeMode === '30d'
          ? '30 days'
          : '90 days';

  return (
    <div className="min-h-screen flex flex-col bg-civic-bg">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* A. Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-[#234f9a] via-[#2f61b5] to-[#234f9a] border-b border-[#1d468b] px-6 py-4 flex items-center justify-between sticky top-0 z-[1200] shadow-md backdrop-blur-sm" role="banner">
        <div className="flex items-center gap-3">
          <div className="h-24 w-24 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-stone-100">
            <img src="/logo.png" alt="Montgomery city seal" className="h-[130%] min-w-[130%] object-cover object-[48%_42%]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">My❤️Montgomery</h1>
            <p className="text-xs text-blue-100 font-medium uppercase tracking-wider">Your City. Clearly Seen.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block max-w-[14rem] text-right">
            <p className="text-xs text-blue-100 font-mono">DATA WINDOW</p>
            <p className="text-xs font-semibold leading-snug text-white">
              {timeWindowStartLabel} → {timeWindowEndLabel}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-white/12 hover:bg-white/18 p-2 rounded-full border border-white/20 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2f61b5]"
            aria-label="Refresh dashboard data"
          >
            <Clock className="w-5 h-5 text-white" aria-hidden />
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

      <main id="main-content" className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex-shrink-0 w-full">
          <SystemStatusStrip
            aiInsightStatus={aiInsightStatus}
            brightDataStatus={brightDataStatus}
            brightDataLoading={systemStatusLoading}
            digestMetadata={digest?.metadata}
            digestLoading={digestLoading}
            signalsLoading={signalsLoading}
            signalCount={signals.length}
          />
        </div>

        {/* B. City Snapshot strip */}
        <div className="flex-shrink-0 w-full">
          <CitySnapshot stats={snapshotStats} />
        </div>

        {/* C. Main operations section: full-width map + supporting panels */}
        <section className="flex-shrink-0 w-full flex flex-col gap-4">
          <CivicMap
            signals={signals}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={setSelectedDistrict}
            timeLabel={mapTimeLabel}
            live={timeMode === 'live'}
            onMapFilterChange={(category, mode) => {
              setMapCategory(category);
              setMapMode(mode);
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] gap-4 items-start lg:items-stretch">
            <div className="flex flex-col gap-4 h-full min-h-0">
              <DistrictInsightPanel
                district={selectedDistrict}
                scopeSignals={currentDistrictScopeSignals}
                comparisonScopeSignals={districtInsightComparisonSignals}
                previousScopeSignals={districtInsightPreviousSignals}
                mapCategory={mapCategory}
                mapMode={mapMode}
                timeMode={timeMode}
                loading={signalsLoading}
              />
              <DistrictPressurePanel
                signals={signals}
                selectedDistrict={selectedDistrict}
                onDistrictSelect={setSelectedDistrict}
                mapCategory={mapCategory}
                mapMode={mapMode}
                className="lg:flex-1"
              />
            </div>

            <aside className="flex flex-col gap-4 self-start lg:self-stretch lg:sticky lg:top-28 h-full min-h-0">
              <CivicDigest
                digest={digest}
                loading={digestLoading}
                selectedCategory={digestCategory}
                onCategoryChange={setDigestCategory}
                onRefresh={async (token) => {
                  try {
                    const res = await fetch('/api/refresh/digest', {
                      method: 'POST',
                      headers: { 'X-Admin-Token': token },
                    });
                    if (res.ok) refreshDigest();
                  } catch (_) {
                    /* ignore */
                  }
                }}
              />
              <div className="pt-4 border-t border-slate-200">
                <LiveTrafficFeeds
                  onAdminRefresh={async (token) => {
                    try {
                      await fetch('/api/refresh/traffic', {
                        method: 'POST',
                        headers: { 'X-Admin-Token': token },
                      });
                    } catch (_) {
                      /* ignore */
                    }
                  }}
                />
              </div>
              <CityPulse selectedDistrict={selectedDistrict} breakdown={breakdown} className="lg:flex-1" />
            </aside>
          </div>
        </section>

        {/* D. Insight row: AI Insight + Trend / Data transparency */}
        <div className="flex-shrink-0 w-full grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
          <div className="w-full min-w-0">
            <AIInsightCard
              window={timeMode === 'custom' ? undefined : timeMode === '90d' ? '90d' : timeMode === '30d' ? '30d' : timeMode === '7d' ? '7d' : 'live'}
              customRange={timeMode === 'custom' ? customRange : undefined}
              selectedDistrict={selectedDistrict}
              onStatusChange={setAiInsightStatus}
            />
          </div>
          <div className="w-full min-w-0">
            <TrendInsights
              trends={trends}
              showComparison={compare}
              dataWindowStart={timeWindowStartLabel}
              dataWindowEnd={timeWindowEndLabel}
              aiInsightStatus={aiInsightStatus}
              scopeSignals={trendScopeSignals}
              previousScopeSignals={previousTrendScopeSignals}
              scopeLabel={trendScopeLabel}
            />
          </div>
        </div>
      </main>

      <footer className="flex-shrink-0 bg-gradient-to-r from-sky-100 via-blue-50 to-sky-100 border-t border-blue-200 p-6 text-center shadow-[0_-10px_24px_-22px_rgba(37,99,235,0.24)]" role="contentinfo">
        <p className="text-xs text-slate-700 font-medium">
          &copy; {new Date().getFullYear()} My❤️Montgomery. Built for civic transparency.
        </p>
      </footer>
    </div>
  );
}
