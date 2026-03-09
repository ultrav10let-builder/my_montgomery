import type { CivicSignal } from '../types';
import { getDistrictForSignal } from './districtBreakdown';

type FilterableMapMode = 'pressure' | 'calls' | 'resources';

export function hasSignalCoordinates<T extends Pick<CivicSignal, 'lat' | 'lng'>>(
  signal: T
): signal is T & { lat: number; lng: number } {
  return signal.lat != null && signal.lng != null;
}

/** Open Data may use different category names; map related traffic records together. */
export function matchesTrafficCategory(category: string): boolean {
  const normalized = category.toLowerCase();
  return normalized === 'traffic'
    || normalized.includes('road')
    || normalized.includes('street')
    || normalized.includes('closure')
    || normalized.includes('detour')
    || normalized.includes('highway')
    || normalized.includes('signal')
    || normalized.includes('traffic');
}

export function filterSignalsByCategory(signals: CivicSignal[], selectedCategory: string | null): CivicSignal[] {
  if (!selectedCategory) return signals;

  if (selectedCategory === 'Traffic') {
    return signals.filter((signal) => matchesTrafficCategory(signal.category || ''));
  }

  const normalizedCategory = selectedCategory.trim().toLowerCase();
  return signals.filter((signal) => (signal.category || '').trim().toLowerCase() === normalizedCategory);
}

export function scopeSignalsToMapSelection(
  signals: CivicSignal[],
  options: {
    selectedDistrict?: string | null;
    selectedCategory?: string | null;
    mapMode?: FilterableMapMode;
  }
): CivicSignal[] {
  const { selectedDistrict = null, selectedCategory = null, mapMode = 'pressure' } = options;
  const categoryScoped = mapMode === 'resources'
    ? signals
    : filterSignalsByCategory(signals, selectedCategory);

  return selectedDistrict
    ? categoryScoped.filter((signal) => getDistrictForSignal(signal) === selectedDistrict)
    : categoryScoped;
}

export function shouldShowCategoryFilters(mapMode: FilterableMapMode): boolean {
  return mapMode !== 'resources';
}

export function shouldUseTrafficFeeds(
  live: boolean,
  mapMode: FilterableMapMode,
  selectedCategory: string | null
): boolean {
  return live && mapMode === 'calls' && selectedCategory === 'Traffic';
}