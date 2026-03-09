/**
 * Point-in-polygon for district/neighborhood assignment.
 * GeoJSON coordinates: [lng, lat]; point: [lat, lng] (Leaflet convention).
 */
import type { Feature } from 'geojson';

/** Ray-casting: point inside polygon. Coords are [lng, lat][] (GeoJSON ring). */
export function pointInPolygon(
  point: [number, number],
  ring: [number, number][]
): boolean {
  const [lat, lng] = point;
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Extract first ring from GeoJSON polygon (exterior). Coords are [lng, lat][]. */
export function getPolygonRing(feature: Feature): [number, number][] {
  const geom = (feature as { geometry?: { coordinates?: unknown[] } }).geometry;
  const coords = geom?.coordinates?.[0];
  if (!coords || !Array.isArray(coords)) return [];
  return coords as [number, number][];
}
