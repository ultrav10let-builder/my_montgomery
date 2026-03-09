# Time Normalization Strategy

This document explains how event timestamps are derived, stored, and displayed in My❤️Montgomery. All dates are stored as ISO 8601 UTC strings; displays use the user's local timezone (or City time: America/Chicago when relevant).

## Canonical Time Fields

Every ingested record (signals, digests) includes:

| Field | Type | Description |
|-------|------|-------------|
| `event_at_utc` | string (ISO 8601) | When the city/source says the event happened |
| `ingested_at_utc` | string (ISO 8601) | When we fetched the record |
| `event_time_confidence` | enum | Reliability of the event time |
| `event_time_source` | string | Which field or parsing method produced `event_at` |

## Confidence Levels

| Level | Meaning | When Assigned |
|-------|---------|---------------|
| **HIGH** | Parsed from a known, specific date field; includes time | Open Data: `created_date`, `opened_date`, etc. with full timestamp. HTML: JSON-LD `datePublished`, meta tags, `<time datetime>`. |
| **MEDIUM** | Date parsed but lacks time; or generic field; or visible text pattern | Open Data: date-only (YYYY-MM-DD). HTML: regex matches like "Published: March 5, 2026". |
| **LOW** | Fallback to `ingested_at_utc` | No parseable date found. Source: `fallback_ingested_at`. |

## Parsing Sources (Open Data)

Each connector provides a prioritized list of candidate date fields. The parser uses the **first** field that exists and parses successfully:

```
created_date, createdDate, CREATED_DATE,
request_date, requestDate, REQUEST_DATE,
opened_date, openedDate, OPENED_AT,
date, DATE,
datetime, timestamp,
published_date, publication_date,
DATE_REPORTED, closed_date, CLOSED_AT, ISSUE_DATE
```

- If the value is date-only (YYYY-MM-DD), we assume **12:00 noon** in America/Chicago to avoid DST edge issues.
- If the value has a timezone offset, we respect it.
- Output is always an ISO UTC string.

## Parsing Sources (Bright Data / HTML)

For scraped pages, we try in order:

1. **JSON-LD** – `script[type="application/ld+json"]` → `datePublished`, `dateModified`, `uploadDate`
2. **Meta tags** – `article:published_time`, `pubdate`, `publish-date`, `og:updated_time`
3. **`<time datetime="...">`** – HTML5 time element
4. **Visible text** – Regex patterns for "Published: March 5, 2026", "Last updated 03/05/2026", "Posted on Mar. 5, 2026"
5. **Fallback** – `event_at_utc = ingested_at_utc`, `confidence = LOW`, `source = fallback_ingested_at`

## Fallback Rules

If no date field parses successfully:

- `event_at_utc` = `ingested_at_utc`
- `confidence` = `LOW`
- `event_time_source` = `fallback_ingested_at`

## Implementation

- **Module**: `server/time/parseEventTime.ts`
- **Functions**:
  - `parseEventTimeFromOpenData(record, fieldPriority)` – for ArcGIS/Open Data
  - `parseEventTimeFromHtml(html, fallbackIngestedAtUtc)` – for Bright Data scraped pages
  - `normalizeToUtc(input, assumedTz?)` – coerces to ISO UTC
  - `coerceDateFromKnownFormats(input)` – parses many common formats (ISO, MM/dd/yyyy, "March 5, 2026", etc.)

## Display

- **User-facing timestamps**: Displayed in user's local timezone (browser default).
- **City time label**: When relevant (e.g., in the Time Control Bar), we label "City time: America/Chicago".
- **Proof of time**: Map popups and digest metadata show `event_at`, `ingested_at`, `confidence`, and `source` for transparency.
