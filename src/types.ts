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
  district?: string | null;
  location_text?: string | null;
  lat: number | null;
  lng: number | null;
  raw_json: string;
  created_at_utc: string;
}

export interface DigestEntry {
  title: string;
  content?: string;
  summary?: string;
  source: string;
  /** Actual external source URL. When null/empty, card shows "No Source URL Provided". */
  url?: string | null;
  category?: string;
  location_text?: string | null;
  district?: string | null;
  neighborhood?: string | null;
}

export type DigestSourceRef = { label?: string; url?: string } | string;

export interface DigestMetadata {
  event_at: string;
  ingested_at?: string;
  confidence: Confidence;
  source: string;
}

export interface DigestResponse {
  items: DigestEntry[];
  sources?: DigestSourceRef[];
  metadata?: DigestMetadata;
  /** Shown when no digest available (e.g. "Click Refresh to fetch") */
  message?: string;
}

export interface CityStats {
  totalRequests: number;
  /** null when previous=0 and current>0 (display "new activity"). */
  changePercent?: number | null;
  topCategory: string;
  activeNeighborhood: string;
  /** Signals per 10,000 residents (city-wide, Census population) */
  signalsPer10k?: number;
  /** null when previous=0 and current>0 (display "new activity"). */
  signalsPer10kChange?: number | null;
}

export interface TrendStats {
  total: number;
  byCategory: { category: string; count: number }[];
  byNeighborhood: { neighborhood: string; count: number }[];
}

export interface TrendResponse {
  windowA: { start: string; end: string; stats: TrendStats };
  windowB: { start: string; end: string; stats: TrendStats };
  signalsPer10k?: number;
  signalsPer10kChange?: number | null;
  categoryMovers: {
    category: string;
    current: number;
    previous: number;
    change: number;
    /** null when previous=0 and current>0 (display "new activity" instead of +100%). */
    percentChange: number | null;
  }[];
  neighborhoodMovers?: {
    neighborhood: string;
    current: number;
    previous: number;
    change: number;
    percentChange: number | null;
  }[];
  overallChange: number;
  /** null when previous total=0 and current>0 (display "new activity"). */
  overallPercentChange: number | null;
  confidenceBreakdown?: {
    windowA: { confidence: string; count: number }[];
    windowB: { confidence: string; count: number }[];
  };
}
