import type { CivicSignal } from '../types';
import { MONTGOMERY_POPULATION } from './citySnapshot';
import { computeDistrictBreakdown } from './districtBreakdown';

export interface DistrictInsightNeighborhood {
  neighborhood: string;
  total: number;
  share: number;
}

export interface DistrictInsightData {
  district: string;
  currentTotal: number;
  comparisonCurrentTotal: number;
  previousTotal: number;
  changePercent?: number | null;
  changeAbsolute?: number;
  signalsPer10kApprox: number;
  citySignalsPer10k: number;
  vsCityRatePercent: number;
  shareOfScopedSignals: number;
  topCategory: string;
  topCategoryCount: number;
  topCategoryShare: number;
  topNeighborhoods: DistrictInsightNeighborhood[];
}

interface BuildDistrictInsightOptions {
  district: string;
  scopeSignals: CivicSignal[];
  comparisonScopeSignals?: CivicSignal[];
  previousScopeSignals?: CivicSignal[];
}

const DISTRICT_COUNT = 9;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function safePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function getDistrictPopulationApprox(): number {
  return MONTGOMERY_POPULATION / DISTRICT_COUNT;
}

export function buildDistrictInsight({
  district,
  scopeSignals,
  comparisonScopeSignals,
  previousScopeSignals,
}: BuildDistrictInsightOptions): DistrictInsightData {
  const currentBreakdown = computeDistrictBreakdown(scopeSignals);
  const comparisonBreakdown = computeDistrictBreakdown(comparisonScopeSignals ?? scopeSignals);
  const previousBreakdown = computeDistrictBreakdown(previousScopeSignals ?? []);

  const currentDistrict = currentBreakdown.find((entry) => entry.district === district);
  const comparisonDistrict = comparisonBreakdown.find((entry) => entry.district === district);
  const previousDistrict = previousBreakdown.find((entry) => entry.district === district);

  const currentTotal = currentDistrict?.total ?? 0;
  const comparisonCurrentTotal = comparisonDistrict?.total ?? currentTotal;
  const previousTotal = previousDistrict?.total ?? 0;
  const scopedCityTotal = currentBreakdown.reduce((sum, entry) => sum + entry.total, 0);
  const citySignalsPer10k = scopedCityTotal > 0
    ? round1((scopedCityTotal / MONTGOMERY_POPULATION) * 10000)
    : 0;
  const signalsPer10kApprox = currentTotal > 0
    ? round1((currentTotal / getDistrictPopulationApprox()) * 10000)
    : 0;
  const vsCityRatePercent = citySignalsPer10k > 0
    ? round1(((signalsPer10kApprox - citySignalsPer10k) / citySignalsPer10k) * 100)
    : 0;
  const topCategoryCount = currentDistrict?.byCategory[0]?.count ?? 0;
  const topCategory = currentDistrict?.byCategory[0]?.category ?? 'No mapped signals';

  return {
    district,
    currentTotal,
    comparisonCurrentTotal,
    previousTotal,
    changePercent: previousScopeSignals ? safePercentChange(comparisonCurrentTotal, previousTotal) : undefined,
    changeAbsolute: previousScopeSignals ? comparisonCurrentTotal - previousTotal : undefined,
    signalsPer10kApprox,
    citySignalsPer10k,
    vsCityRatePercent,
    shareOfScopedSignals: scopedCityTotal > 0 ? round1((currentTotal / scopedCityTotal) * 100) : 0,
    topCategory,
    topCategoryCount,
    topCategoryShare: currentTotal > 0 ? round1((topCategoryCount / currentTotal) * 100) : 0,
    topNeighborhoods: (currentDistrict?.neighborhoods ?? []).slice(0, 3).map((entry) => ({
      neighborhood: entry.neighborhood,
      total: entry.total,
      share: currentTotal > 0 ? round1((entry.total / currentTotal) * 100) : 0,
    })),
  };
}