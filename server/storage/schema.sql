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
