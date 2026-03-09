import React, { useState, useMemo, useEffect } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import { CivicSignal } from '../types';
import { safeFormat } from '../utils/dateUtils';
import { pressureScoreToColor, pressureScoreToLabel, signalCountToPressureScore } from '../utils/pressureColors';
import { computeDistrictBreakdown, getDistrictForCoords } from '../utils/districtBreakdown';
import { buildDistrictLayerKey, buildDistrictStatusSnapshot, getDistrictStatusSnapshot } from '../utils/districtMapStatus';
import { getCategoryIcon, getCategoryLabel } from '../utils/mapIcons';
import { getCategoryColor } from '../utils/categoryColors';
import {
  filterSignalsByCategory,
  hasSignalCoordinates,
  shouldShowCategoryFilters,
  shouldUseTrafficFeeds,
} from '../utils/civicMapFilters';
import { trafficFeedsToRoadScores, getScoreForOsmRef } from '../utils/trafficMapUtils';
import { useTrafficFeeds } from '../hooks/useTrafficFeeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import districtGeo from '../data/montgomery_districts.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAP_CATEGORIES = ['All', 'Traffic', 'Parks', 'Civic', 'Planning', 'Infrastructure', 'Sanitation', 'Public Safety'];

const DISTRICT_GEO = districtGeo as FeatureCollection<Polygon>;

function districtSortValue(name: string): number {
  const match = name.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

const DISTRICT_OPTIONS = [...new Set(
  (DISTRICT_GEO.features ?? [])
    .map((feature) => (feature.properties as { name?: string } | undefined)?.name ?? '')
    .filter(Boolean)
)].sort((a, b) => districtSortValue(a) - districtSortValue(b) || a.localeCompare(b));

export type MapMode = 'pressure' | 'calls' | 'resources';
const PRIMARY_MAP_MODES: MapMode[] = ['pressure', 'calls', 'resources'];

/** Stub city resource/service locations – placeholder until full Open Data integration. */
const RESOURCE_STUBS: { id: string; name: string; type: string; lat: number; lng: number; url?: string }[] = [
  { id: 'city-hall', name: 'City Hall', type: 'Civic', lat: 32.377, lng: -86.3009, url: 'https://www.montgomeryal.gov' },
  { id: 'public-works', name: 'Public Works', type: 'Infrastructure', lat: 32.375, lng: -86.302, url: 'https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services' },
  { id: 'parks-rec', name: 'Parks & Recreation', type: 'Parks', lat: 32.376, lng: -86.301, url: 'https://www.montgomeryal.gov/play/explore-montgomery/parks-trails-and-natural-areas/parks' },
  { id: 'public-safety', name: 'Public Safety / MPD', type: 'Public Safety', lat: 32.374, lng: -86.3015, url: 'https://www.montgomeryal.gov/city-government/departments/public-safety-test' },
  { id: 'fire-station', name: 'Fire Station (Central)', type: 'Public Safety', lat: 32.368, lng: -86.298 },
];

interface CivicMapProps {
  signals: CivicSignal[];
  selectedDistrict: string | null;
  onDistrictSelect: (district: string | null) => void;
  timeLabel?: string;
  /** When true (live mode), traffic feeds use 4h window (active incidents only). */
  live?: boolean;
  /** Notify parent when map filter changes so district panel stays synced. */
  onMapFilterChange?: (category: string | null, mode: MapMode) => void;
}

/** Trigger Leaflet to recalc size after layout. Fixes map rendering when parent height is explicit. */
function MapSizeSync() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/** Compute polygon centroid [lat, lng] from GeoJSON ring [lng, lat][]. */
function polygonCentroid(ring: [number, number][]): [number, number] {
  if (!ring.length) return [32.3668, -86.3];
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLat / ring.length, sumLng / ring.length];
}

export function CivicMap({ signals, selectedDistrict, onDistrictSelect, timeLabel = '7 days', live = false, onMapFilterChange }: CivicMapProps) {
  const [mapMode, setMapMode] = useState<MapMode>('pressure');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { feeds: trafficFeeds } = useTrafficFeeds(live);
  const [roadsGeoJson, setRoadsGeoJson] = useState<FeatureCollection<LineString> | null>(null);

  useEffect(() => {
    onMapFilterChange?.(selectedCategory, mapMode);
  }, [selectedCategory, mapMode, onMapFilterChange]);

  useEffect(() => {
    const useTrafficFeedsInCalls = shouldUseTrafficFeeds(live, mapMode, selectedCategory);
    if (!useTrafficFeedsInCalls) {
      setRoadsGeoJson(null);
      return;
    }
    fetch('/api/roads/geojson')
      .then((r) => r.json())
      .then(setRoadsGeoJson)
      .catch(() => setRoadsGeoJson(null));
  }, [live, mapMode, selectedCategory]);

  const filteredSignals = useMemo(
    () => filterSignalsByCategory(signals, selectedCategory),
    [signals, selectedCategory]
  );

  /** Use selected category for district summaries too, so layers stay available in pressure mode. */
  const pressureSignals = selectedCategory ? filteredSignals : signals;
  const breakdown = useMemo(() => computeDistrictBreakdown(pressureSignals), [pressureSignals]);
  const cityTotal = pressureSignals.length;
  const districtCount = Math.max(breakdown.length, 1);
  const districtPressureScores = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of breakdown) {
      m.set(d.district, signalCountToPressureScore(d.total, cityTotal, districtCount));
    }
    return m;
  }, [breakdown, cityTotal, districtCount]);

  const districtTopIssues = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of breakdown) {
      const top = d.byCategory[0]?.category;
      if (top) m.set(d.district, top);
    }
    return m;
  }, [breakdown]);

  const districtStatusByName = useMemo(
    () => buildDistrictStatusSnapshot(breakdown, districtPressureScores, districtTopIssues),
    [breakdown, districtPressureScores, districtTopIssues]
  );

  const districtLayerKey = useMemo(
    () => buildDistrictLayerKey({
      mapMode,
      selectedCategory,
      selectedDistrict,
      timeLabel,
      statusByDistrict: districtStatusByName,
    }),
    [mapMode, selectedCategory, selectedDistrict, timeLabel, districtStatusByName]
  );

  /** When a district is selected, show only markers within that district. Preserves category/mode filters. */
  const mappedSignals = filteredSignals.filter(hasSignalCoordinates);
  const markersSignals = selectedDistrict
    ? mappedSignals.filter((s) => getDistrictForCoords(s.lat, s.lng) === selectedDistrict)
    : mappedSignals;

  const markersTrafficFeeds = selectedDistrict
    ? trafficFeeds.filter((f) => f.latitude != null && f.longitude != null && getDistrictForCoords(f.latitude!, f.longitude!) === selectedDistrict)
    : trafficFeeds.filter((f) => f.latitude != null && f.longitude != null);

  const useTrafficFeedsInCalls = shouldUseTrafficFeeds(live, mapMode, selectedCategory);
  const pressureDistrictCount = districtTopIssues.size;
  const visibleCount = mapMode === 'pressure'
    ? pressureDistrictCount
    : (useTrafficFeedsInCalls ? markersTrafficFeeds.length : markersSignals.length);
  const visibleCountLabel = mapMode === 'pressure'
    ? 'district markers'
    : (useTrafficFeedsInCalls ? 'traffic items' : 'mapped signals');
  const callsModeLabel = useTrafficFeedsInCalls
    ? 'Road conditions (Bright Data)'
    : selectedCategory === 'Traffic'
      ? 'Traffic signals'
      : '311 / civic signals';
  const viewScopeLabel = selectedDistrict ?? 'All districts';

  const roadScores = useMemo(
    () => (useTrafficFeedsInCalls ? trafficFeedsToRoadScores(trafficFeeds) : {}),
    [useTrafficFeedsInCalls, trafficFeeds]
  );

  /** Create category icon for map markers. */
  const createMarkerIcon = (emoji: string, color: string) =>
    divIcon({
      html: `<div style="
        display:flex;align-items:center;justify-content:center;
        width:32px;height:32px;border-radius:50%;
        background:${color};color:#fff;font-size:16px;line-height:1;
        border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);
      ">${emoji}</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

  /** Parse description from signal raw_json. */
  const getSignalDescription = (signal: CivicSignal): string | null => {
    try {
      const raw = JSON.parse(signal.raw_json || '{}');
      return (raw.description as string) || null;
    } catch {
      return null;
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-[460px] sm:h-[540px] xl:h-[680px] ring-2 ring-slate-200/60 border-t-2 border-t-civic-blue/30" aria-label="Civic operations map of Montgomery districts" aria-describedby="civic-map-help">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-civic-blue flex-shrink-0" />
              <h2 className="text-base font-bold text-slate-900">Civic Operations Map</h2>
            </div>
            <p className="text-xs text-slate-600 pl-7">
              {mapMode === 'pressure' && 'District overview by pressure · top issue markers'}
              {mapMode === 'calls' && callsModeLabel}
              {mapMode === 'resources' && 'City resource & service locations'}
              <span className="text-slate-600 ml-2">
                {mapMode === 'calls' && (useTrafficFeedsInCalls ? `· ${markersTrafficFeeds.length} feeds` : `· ${markersSignals.length} signals`)}
                {mapMode === 'pressure' && `· ${pressureSignals.length} signals across ${pressureDistrictCount} districts · ${timeLabel}`}
                {mapMode === 'resources' && `· ${RESOURCE_STUBS.length} locations`}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedDistrict && (
              <button
                type="button"
                onClick={() => onDistrictSelect(null)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-civic-blue hover:bg-slate-200 transition-all focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2"
                aria-label="View all districts"
              >
                View all districts
              </button>
            )}
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">District:</span>
              <select
                value={selectedDistrict ?? ''}
                onChange={(event) => onDistrictSelect(event.target.value || null)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2"
                aria-label="Select district scope"
              >
                <option value="">All districts</option>
                {DISTRICT_OPTIONS.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>
            <span className="text-xs font-medium text-slate-600 hidden sm:inline">View:</span>
            {PRIMARY_MAP_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMapMode(mode)}
                aria-pressed={mapMode === mode}
                aria-label={`Show ${mode} view`}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2",
                  mapMode === mode
                    ? "bg-civic-blue text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            Scope: {viewScopeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 font-medium text-civic-blue">
            {live ? 'Live active view' : timeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {visibleCount} {visibleCountLabel}
          </span>
          {selectedCategory && shouldShowCategoryFilters(mapMode) && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
              Filter: {selectedCategory}
            </span>
          )}
        </div>
        <p id="civic-map-help" className="text-[11px] text-slate-600">
          Use the district dropdown for keyboard navigation, or click a district on the map to scope the dashboard.
        </p>

        {(mapMode === 'pressure' || mapMode === 'calls') && (
          <div className="flex items-center gap-3 text-[10px] text-slate-600 flex-wrap">
            <span className="font-medium">Stress:</span>
            {['Good', 'Caution', 'Attention', 'High priority'].map((label, i) => {
              const colors = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
              return (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[i] }} />
                  {label}
                </span>
              );
            })}
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span>Pressure = district summary</span>
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span>Calls = mapped incidents</span>
          </div>
        )}
        {shouldShowCategoryFilters(mapMode) && (
        <div className="flex gap-1.5 flex-wrap items-center" role="group" aria-label="Filter markers by category">
          {MAP_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
              aria-pressed={selectedCategory === cat || (cat === "All" && !selectedCategory)}
              aria-label={cat === 'All' ? 'Show all categories' : `Filter by ${cat}`}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2",
                (selectedCategory === cat || (cat === "All" && !selectedCategory))
                  ? "bg-civic-blue text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        )}
      </div>
      <div className="flex-1 relative min-h-0">
        <MapContainer center={[32.3668, -86.3000]} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <MapSizeSync />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* District polygons – Montgomery districts 1–9, click to select */}
          <GeoJSON
            key={districtLayerKey}
            data={DISTRICT_GEO}
            pathOptions={{ zIndexOffset: -200, className: 'cursor-pointer' }}
            style={(feature) => {
              const name = (feature?.properties as { name?: string })?.name ?? '';
              const isSelected = selectedDistrict === name;
              const { score } = getDistrictStatusSnapshot(districtStatusByName, name);
              const stressColor = pressureScoreToColor(score);
              const CIVIC_BLUE = '#1a365d';
              if (isSelected) {
                return {
                  color: CIVIC_BLUE,
                  weight: 4,
                  opacity: 1,
                  fillColor: CIVIC_BLUE,
                  fillOpacity: 0.22,
                };
              }
              if (mapMode === 'pressure') {
                return {
                  color: stressColor,
                  weight: 2,
                  opacity: 0.9,
                  fillColor: stressColor,
                  fillOpacity: 0.18,
                };
              }
              if (mapMode === 'calls') {
                return {
                  color: stressColor,
                  weight: 2,
                  opacity: 0.85,
                  fillColor: stressColor,
                  fillOpacity: 0.15,
                };
              }
              return {
                color: '#94a3b8',
                weight: 1.5,
                opacity: 0.6,
                fillColor: '#cbd5e1',
                fillOpacity: 0.12,
              };
            }}
            onEachFeature={(feature, layer) => {
              const name = (feature?.properties as { name?: string })?.name ?? '';
              layer.on({
                click: () => {
                  onDistrictSelect(selectedDistrict === name ? null : name);
                },
              });
              const { score, total: districtTotal, topIssue } = getDistrictStatusSnapshot(districtStatusByName, name);
              const statusLabel = pressureScoreToLabel(score);
              let label = `${name} · ${statusLabel}`;
              if (districtTotal > 0) label += ` (${districtTotal} signal${districtTotal !== 1 ? 's' : ''} · ${timeLabel})`;
              if (topIssue) label += ` · Top: ${topIssue}`;
              layer.bindTooltip(label, { sticky: true, direction: 'top' });
            }}
          />

          {/* Top issue markers – Pressure mode: district centroids with dominant category */}
          {mapMode === 'pressure' &&
            (DISTRICT_GEO.features ?? []).map((feat) => {
              const name = (feat.properties as { name?: string })?.name ?? '';
              const { score, total, topIssue } = getDistrictStatusSnapshot(districtStatusByName, name);
              if (!topIssue) return null;
              const coords = feat.geometry.coordinates?.[0]?.flatMap((position) => (
                typeof position[0] === 'number' && typeof position[1] === 'number'
                  ? [[position[0], position[1]] as [number, number]]
                  : []
              ));
              if (!coords?.length) return null;
              const [lat, lng] = polygonCentroid(coords);
              const icon = getCategoryIcon(topIssue, '');
              const markerIcon = divIcon({
                html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#1a365d;color:#fff;font-size:12px;line-height:1;border:1px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.3)">${icon}</div>`,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              });
              return (
                <Marker key={`top-${name}`} position={[lat, lng]} icon={markerIcon}>
                  <Popup>
                    <div className="p-2 min-w-[160px]">
                      <p className="text-xs font-bold text-slate-900">{name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{pressureScoreToLabel(score)} · {total} signals</p>
                      <p className="text-sm font-medium text-slate-800 mt-1">Top issue: {topIssue}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          
          {/* Road polylines – Calls mode only, when Traffic selected */}
          {useTrafficFeedsInCalls && roadsGeoJson && (
            <GeoJSON
              key="traffic-roads"
              data={roadsGeoJson}
              pathOptions={{ zIndexOffset: -100 }}
              style={(feature) => {
                const ref = (feature?.properties as { ref?: string })?.ref ?? '';
                const score = getScoreForOsmRef(ref, roadScores);
                const color = pressureScoreToColor(score);
                return {
                  color,
                  weight: 6,
                  opacity: 0.9,
                  fill: false
                };
              }}
              onEachFeature={(feature, layer) => {
                const ref = (feature?.properties as { ref?: string })?.ref ?? '';
                const score = getScoreForOsmRef(ref, roadScores);
                const label = pressureScoreToLabel(score);
                layer.bindTooltip(
                  `${ref || 'Road'}: ${label}`,
                  { sticky: true, direction: 'top' }
                );
              }}
            />
          )}

          {/* Incident markers – Calls mode, when Traffic selected */}
          {useTrafficFeedsInCalls &&
            markersTrafficFeeds.map((feed) => {
                const icon = getCategoryIcon('Traffic', feed.description);
                const markerIcon = divIcon({
                  html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">${icon}</div>`,
                  className: '',
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                });
                return (
                  <Marker key={feed.id} position={[feed.latitude!, feed.longitude!]} icon={markerIcon}>
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <p className="text-xs font-bold text-slate-900">{feed.road || 'Traffic incident'}</p>
                        <p className="text-sm text-slate-700 mt-0.5 leading-snug">{feed.description}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{feed.source_label}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

          {/* Signal markers – Calls mode only */}
          {mapMode === 'calls' && !useTrafficFeedsInCalls && markersSignals.map(signal => {
            let description = '';
            try {
              const raw = JSON.parse(signal.raw_json || '{}');
              description = (raw as { description?: string }).description || '';
            } catch { /* ignore */ }
            const icon = getCategoryIcon(signal.category, description);
            const color = getCategoryColor(signal.category || '');
            const markerIcon = createMarkerIcon(icon, color);
            const categoryLabel = getCategoryLabel(signal.category);
            return (
              <Marker key={signal.id} position={[signal.lat, signal.lng]} icon={markerIcon}>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <p className="text-xs font-bold text-slate-900">{signal.category}</p>
                    <p className="text-sm text-slate-700 mt-0.5 leading-snug">
                      {description || categoryLabel || '311 request'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{signal.neighborhood || 'Unknown'} · {safeFormat(signal.event_at_utc, 'MMM d')}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Resource markers – Resources mode only (stub data) */}
          {mapMode === 'resources' &&
            RESOURCE_STUBS.filter((r) => !selectedDistrict || getDistrictForCoords(r.lat, r.lng) === selectedDistrict)
            .map((r) => {
              const icon = getCategoryIcon(r.type, '');
              const markerIcon = divIcon({
                html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#1a365d;color:#fff;font-size:14px;line-height:1;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${icon}</div>`,
                className: '',
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              });
              return (
                <Marker key={r.id} position={[r.lat, r.lng]} icon={markerIcon}>
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <p className="text-xs font-bold text-slate-900">{r.type}</p>
                      <p className="text-sm text-slate-700 mt-0.5">{r.name}</p>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-civic-blue hover:underline mt-1 block">
                          View on montgomeryal.gov
                        </a>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>
      </div>
    </section>
  );
}


