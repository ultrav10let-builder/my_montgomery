import type { CivicSignal, TrendResponse } from '../types';

export type TrendMoverLike = Pick<
  TrendResponse['categoryMovers'][number],
  'category' | 'current' | 'previous' | 'percentChange'
>;

export interface CurrentMixItem {
  category: string;
  current: number;
  share: number;
}

function normalizeCategory(category: string | null | undefined): string {
  const value = category?.trim();
  return value || 'Uncategorized';
}

function safePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function formatShare(share: number): string {
  return `${share >= 10 ? share.toFixed(0) : share.toFixed(1)}%`;
}

export function buildCurrentCategoryMix(
  signals: Array<Pick<CivicSignal, 'category'>>,
): CurrentMixItem[] {
  const total = signals.length;
  const counts = new Map<string, number>();

  for (const signal of signals) {
    const category = signal.category?.trim() || 'Uncategorized';
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, current]) => ({
      category,
      current,
      share: total > 0 ? (current / total) * 100 : 0,
    }))
    .sort((a, b) => b.current - a.current || a.category.localeCompare(b.category));
}

export function buildComparisonMovers(
  currentSignals: Array<Pick<CivicSignal, 'category'>>,
  previousSignals: Array<Pick<CivicSignal, 'category'>>,
): TrendMoverLike[] {
  const currentCounts = new Map<string, number>();
  const previousCounts = new Map<string, number>();

  for (const signal of currentSignals) {
    const category = normalizeCategory(signal.category);
    currentCounts.set(category, (currentCounts.get(category) ?? 0) + 1);
  }

  for (const signal of previousSignals) {
    const category = normalizeCategory(signal.category);
    previousCounts.set(category, (previousCounts.get(category) ?? 0) + 1);
  }

  const categories = new Set([...currentCounts.keys(), ...previousCounts.keys()]);

  return Array.from(categories)
    .map((category) => {
      const current = currentCounts.get(category) ?? 0;
      const previous = previousCounts.get(category) ?? 0;
      return {
        category,
        current,
        previous,
        percentChange: safePercentChange(current, previous),
      };
    })
    .filter((item) => item.current > 0 || item.previous > 0)
    .sort((a, b) => {
      const changeDelta = Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous);
      if (changeDelta !== 0) return changeDelta;
      return b.current - a.current || a.category.localeCompare(b.category);
    });
}

export function getCurrentMixSummary(
  mix: CurrentMixItem[],
  totalSignals: number,
): string {
  if (totalSignals === 0) return 'No signals in the current dashboard scope.';

  const top = mix[0];
  if (!top) return `${totalSignals} signals in the current dashboard scope.`;

  return `${totalSignals} signals in the current dashboard scope. ${top.category} leads with ${formatShare(top.share)}.`;
}

export function getComparisonSummary(movers: TrendMoverLike[]): string {
  if (movers.length === 0) return 'No signals in this scope across the matched windows.';

  const rising = movers.filter(
    (m) => m.percentChange != null && m.percentChange > 0,
  );
  const falling = movers.filter(
    (m) => m.percentChange != null && m.percentChange < 0,
  );
  const newActivity = movers.filter((m) => m.previous === 0 && m.current > 0);

  if (rising.length === 0 && falling.length === 0 && newActivity.length === 0) {
    return 'No notable changes in civic activity.';
  }

  const parts: string[] = [];

  if (newActivity.length > 0) {
    const top = newActivity.reduce((a, b) => (a.current >= b.current ? a : b));
    parts.push(`${top.category} newly appeared (${top.current} signals)`);
  }

  if (rising.length > 0 && parts.length < 2) {
    const top = rising.reduce((a, b) =>
      (a.percentChange ?? 0) >= (b.percentChange ?? 0) ? a : b,
    );
    parts.push(`${top.category} up ${top.percentChange!.toFixed(0)}% (${top.current} signals)`);
  }

  if (falling.length > 0 && parts.length < 2) {
    const top = falling.reduce((a, b) =>
      (a.percentChange ?? 0) <= (b.percentChange ?? 0) ? a : b,
    );
    parts.push(`${top.category} down ${Math.abs(top.percentChange!).toFixed(0)}%`);
  }

  return `${parts.join('. ')}.`;
}

export function formatCurrentMixValue(item: CurrentMixItem): string {
  return `${formatShare(item.share)} share`;
}

export function formatComparisonValue(mover: TrendMoverLike): string {
  if (mover.previous === 0 && mover.current > 0) return `+${mover.current} new`;
  if (mover.percentChange == null) return '—';
  return mover.percentChange >= 0
    ? `+${mover.percentChange.toFixed(1)}%`
    : `${mover.percentChange.toFixed(1)}%`;
}