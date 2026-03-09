/**
 * Category colors shared between map dots and Trend Engine.
 * Each category has a consistent color across the app.
 */

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'Infrastructure': return '#3b82f6';   // blue
    case 'Sanitation': return '#22c55e';        // green
    case 'Public Safety': return '#ef4444';    // red
    case 'Parks': return '#84cc16';             // lime
    case 'Traffic': return '#f97316';           // orange
    case 'Civic': return '#64748b';             // slate
    case 'Planning': return '#8b5cf6';          // violet
    case 'Signals': return '#06b6d4';          // cyan
    default: return '#64748b';
  }
}
