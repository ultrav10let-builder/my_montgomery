export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CivicSignal {
  id: string;
  snapshot_id: string;
  event_at_utc: string;
  ingested_at_utc: string;
  event_time_confidence: Confidence;
  event_time_source: string;
  category: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  raw_json: string;
  created_at_utc: string;
}

export interface DigestEntry {
  title: string;
  content: string;
  source: string;
  url: string;
}

export interface DigestMetadata {
  event_at: string;
  confidence: Confidence;
  source: string;
}

export interface DigestResponse {
  items: DigestEntry[];
  sources?: { label: string; url: string }[];
  metadata?: DigestMetadata;
}

export interface CityStats {
  totalRequests: number;
  changePercent: number;
  topCategory: string;
  activeNeighborhood: string;
}

export interface TrendStats {
  total: number;
  byCategory: { category: string; count: number }[];
  byNeighborhood: { neighborhood: string; count: number }[];
}

export interface TrendResponse {
  windowA: { start: string; end: string; stats: TrendStats };
  windowB: { start: string; end: string; stats: TrendStats };
  categoryMovers: {
    category: string;
    current: number;
    previous: number;
    change: number;
    percentChange: number;
  }[];
  overallChange: number;
  overallPercentChange: number;
}
