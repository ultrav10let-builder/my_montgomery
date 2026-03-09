import type { DistrictBreakdown } from './districtBreakdown';
import { normalizeDistrictKey } from './pressureColors';

export interface DistrictStatusSnapshot {
  score: number;
  total: number;
  topIssue?: string;
}

interface DistrictLayerKeyOptions {
  mapMode: 'pressure' | 'calls' | 'resources';
  selectedCategory?: string | null;
  selectedDistrict?: string | null;
  timeLabel: string;
  statusByDistrict: Map<string, DistrictStatusSnapshot>;
}

export function buildDistrictStatusSnapshot(
  breakdown: DistrictBreakdown[],
  districtPressureScores: Map<string, number>,
  districtTopIssues: Map<string, string>
): Map<string, DistrictStatusSnapshot> {
  const snapshot = new Map<string, DistrictStatusSnapshot>();

  for (const district of breakdown) {
    snapshot.set(normalizeDistrictKey(district.district), {
      score: districtPressureScores.get(district.district) ?? 0,
      total: district.total,
      topIssue: districtTopIssues.get(district.district),
    });
  }

  return snapshot;
}

export function getDistrictStatusSnapshot(
  statusByDistrict: Map<string, DistrictStatusSnapshot>,
  districtName: string
): DistrictStatusSnapshot {
  return statusByDistrict.get(normalizeDistrictKey(districtName)) ?? { score: 0, total: 0 };
}

export function buildDistrictLayerKey({
  mapMode,
  selectedCategory,
  selectedDistrict,
  timeLabel,
  statusByDistrict,
}: DistrictLayerKeyOptions): string {
  const statusVersion = Array.from(statusByDistrict.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([district, status]) => `${district}:${status.score}:${status.total}:${status.topIssue ?? ''}`)
    .join('|');

  return [
    mapMode,
    selectedCategory ?? 'all',
    selectedDistrict ?? 'all',
    timeLabel,
    statusVersion,
  ].join('::');
}