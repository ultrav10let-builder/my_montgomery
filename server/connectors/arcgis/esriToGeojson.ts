export function esriToGeojson(geometry: any): any {
  if (!geometry) return null;

  // Point
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return {
      type: 'Point',
      coordinates: [geometry.x, geometry.y]
    };
  }

  // Polygon
  if (geometry.rings) {
    return {
      type: 'Polygon',
      coordinates: geometry.rings
    };
  }

  // Polyline
  if (geometry.paths) {
    return {
      type: 'MultiLineString',
      coordinates: geometry.paths
    };
  }

  return null;
}
