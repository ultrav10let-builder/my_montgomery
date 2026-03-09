import type { CityStats, CivicSignal, TrendResponse } from '../types';

export const MONTGOMERY_POPULATION = 195818;
const DISTRICT_POPULATION_APPROX = MONTGOMERY_POPULATION / 9;

function getTopValue(values: Array<string | null | undefined>, fallback = 'N/A'): string {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = (value ?? '').trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? fallback;
}

function roundSignalsPer10k(totalRequests: number, population = MONTGOMERY_POPULATION): number {
  return Math.round((totalRequests / Math.max(population, 1)) * 10000 * 10) / 10;
}

function buildSnapshotFromSignals(signals: CivicSignal[], population: number): CityStats | null {
  if (!signals.length) return null;

  return {
    totalRequests: signals.length,
    topCategory: getTopValue(signals.map((signal) => signal.category)),
    activeNeighborhood: getTopValue(signals.map((signal) => signal.neighborhood)),
    signalsPer10k: roundSignalsPer10k(signals.length, population),
  };
}

function hasUsableTrendStats(trends: TrendResponse | null, signalCount: number): trends is TrendResponse {
  const stats = trends?.windowA?.stats;
  if (!stats) return false;
  if (signalCount === 0) return true;
  return stats.total > 0 || stats.byCategory.length > 0 || stats.byNeighborhood.length > 0;
}

export function buildCitySnapshotFromSignals(signals: CivicSignal[]): CityStats | null {
  return buildSnapshotFromSignals(signals, MONTGOMERY_POPULATION);
}

export function buildDistrictSnapshotFromSignals(signals: CivicSignal[]): CityStats | null {
  return buildSnapshotFromSignals(signals, DISTRICT_POPULATION_APPROX);
}

export function buildCityWideSnapshotStats(signals: CivicSignal[], trends: TrendResponse | null): CityStats | null {
  const fallback = buildCitySnapshotFromSignals(signals);

  if (!hasUsableTrendStats(trends, signals.length)) {
    return fallback;
  }

  const stats = trends.windowA.stats;

  return {
    totalRequests: stats.total,
    changePercent: trends.overallPercentChange,
    topCategory: stats.byCategory[0]?.category || fallback?.topCategory || 'N/A',
    activeNeighborhood: stats.byNeighborhood[0]?.neighborhood || fallback?.activeNeighborhood || 'N/A',
    signalsPer10k: trends.signalsPer10k ?? fallback?.signalsPer10k ?? roundSignalsPer10k(stats.total),
    signalsPer10kChange: trends.signalsPer10kChange ?? undefined,
  };
}