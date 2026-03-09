/**
 * Category-specific map icons for civic signals.
 * Traffic: car/collision, Construction/Infrastructure: cones, etc.
 */

/** Category icons for map pins: traffic, parks, civic, planning, safety, signals */
export const CATEGORY_ICONS: Record<string, string> = {
  Traffic: '🚗',
  Infrastructure: '🚧',
  Sanitation: '🗑️',
  'Public Safety': '🛡️',
  Parks: '🌳',
  Civic: '🏛️',
  Planning: '📋',
  Signals: '📡',
};

/** Icon for traffic accidents (when description suggests collision). */
export const TRAFFIC_ACCIDENT_ICON = '🚗💥';

/** Default icon when category unknown. */
export const DEFAULT_ICON = '📍';

export function getCategoryIcon(category: string, description?: string): string {
  const cat = (category || '').trim();
  if (cat === 'Traffic' && description) {
    const d = description.toLowerCase();
    if (d.includes('accident') || d.includes('collision') || d.includes('crash')) {
      return TRAFFIC_ACCIDENT_ICON;
    }
  }
  return CATEGORY_ICONS[cat] ?? DEFAULT_ICON;
}

/** Human-readable "what this marker represents" by category. */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'Traffic': return 'Traffic incident or 311 request';
    case 'Infrastructure': return 'Infrastructure (pothole, streetlight, construction)';
    case 'Sanitation': return 'Sanitation (trash, recycling, bulk pickup)';
    case 'Public Safety': return 'Public Safety (noise, community watch)';
    case 'Parks': return 'Parks & Recreation';
    case 'Civic': return 'Civic (zoning, permits, council)';
    case 'Planning': return 'Planning & zoning';
    case 'Signals': return '311 / civic signal';
    default: return '311 / civic request';
  }
}
