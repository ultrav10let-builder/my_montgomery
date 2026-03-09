/**
 * Server-side point-in-polygon for district filtering.
 * GeoJSON ring: [lng, lat][]; point: [lat, lng] (signals use lat/lng).
 */
export function pointInPolygon(
  point: [number, number],
  ring: [number, number][]
): boolean {
  const [lat, lng] = point;
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i]; // xi=lng, yi=lat
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
