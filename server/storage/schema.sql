-- Snapshots Table
CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    snapshot_at_utc TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

-- Civic Signals Table
CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
    event_at_utc TEXT NOT NULL,
    ingested_at_utc TEXT NOT NULL,
    event_time_confidence TEXT NOT NULL,
    event_time_source TEXT NOT NULL,
    category TEXT,
    neighborhood TEXT,
    lat REAL,
    lng REAL,
    raw_json TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

-- Indexes for signals
CREATE INDEX IF NOT EXISTS idx_signals_event_at ON signals(event_at_utc);
CREATE INDEX IF NOT EXISTS idx_signals_category ON signals(category);
CREATE INDEX IF NOT EXISTS idx_signals_neighborhood ON signals(neighborhood);

-- Data Sources Table
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    last_run TEXT,
    record_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle'
);

-- Digests Table
CREATE TABLE IF NOT EXISTS digests (
    id TEXT PRIMARY KEY,
    date_key TEXT NOT NULL,
    event_at_utc TEXT NOT NULL,
    ingested_at_utc TEXT NOT NULL,
    event_time_confidence TEXT NOT NULL,
    event_time_source TEXT NOT NULL,
    items_json TEXT NOT NULL,
    sources_json TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    UNIQUE(date_key)
);

-- Indexes for digests
CREATE INDEX IF NOT EXISTS idx_digests_event_at ON digests(event_at_utc);

-- Digest Items Table (Phase 2: structured, category-aware records from Bright Data digest)
CREATE TABLE IF NOT EXISTS digest_items (
    id TEXT PRIMARY KEY,
    digest_date TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    event_at_utc TEXT,
    ingested_at_utc TEXT NOT NULL,
    location_text TEXT,
    city TEXT,
    raw_json TEXT,
    created_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_digest_items_digest_date ON digest_items(digest_date);
CREATE INDEX IF NOT EXISTS idx_digest_items_category ON digest_items(category);
CREATE INDEX IF NOT EXISTS idx_digest_items_ingested ON digest_items(ingested_at_utc);

-- Traffic Feeds Table (Bright Data scraped live traffic)
CREATE TABLE IF NOT EXISTS traffic_feeds (
    id TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_label TEXT NOT NULL,
    road TEXT,
    direction TEXT,
    description TEXT NOT NULL,
    severity TEXT,
    latitude REAL,
    longitude REAL,
    raw_json TEXT,
    ingested_at_utc TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_feeds_ingested ON traffic_feeds(ingested_at_utc);

-- Insights cache (Phase 4 – cost control, regenerate every 10 minutes)
CREATE TABLE IF NOT EXISTS insights_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time_window TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    insight TEXT NOT NULL,
    provider TEXT DEFAULT 'fallback',
    UNIQUE(time_window)
);

CREATE INDEX IF NOT EXISTS idx_insights_cache_generated ON insights_cache(generated_at);
