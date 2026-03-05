import { ArcGISFeature } from './arcgisClient';
import { esriToGeojson } from './esriToGeojson';

export interface NormalizedSignal {
  id: string;
  signal_type: string;
  category: string;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  district: string | null;
  source_id: string;
  raw_json: string;
}

export function normalizeArcGISFeature(feature: ArcGISFeature, sourceId: string): NormalizedSignal {
  const attr = feature.attributes;
  const geo = esriToGeojson(feature.geometry);

  // Default mapping (can be customized per layer)
  const id = attr.OBJECTID || attr.FID || attr.GlobalID || Math.random().toString(36).substr(2, 9);
  
  let lat = null;
  let lng = null;
  if (geo && geo.type === 'Point') {
    lng = geo.coordinates[0];
    lat = geo.coordinates[1];
  }

  return {
    id: `${sourceId}_${id}`,
    signal_type: attr.TYPE || attr.CATEGORY || 'General',
    category: attr.CATEGORY || attr.TYPE || 'Civic',
    status: attr.STATUS || attr.STATE || 'Unknown',
    opened_at: attr.OPENED_AT || attr.CREATED_DATE || attr.DATE || null,
    closed_at: attr.CLOSED_AT || attr.COMPLETED_DATE || null,
    lat,
    lng,
    neighborhood: attr.NEIGHBORHOOD || attr.COMMUNITY || null,
    district: attr.DISTRICT || attr.WARD || null,
    source_id: sourceId,
    raw_json: JSON.stringify(feature)
  };
}
