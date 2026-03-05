# UI Wireframe Layout (Intended)

------------------------------------------------------
| My❤️Montgomery                     Last Updated     |
| Your City. Clearly Seen.                            |
------------------------------------------------------

CITY SNAPSHOT (7 days)

[ 311 Requests ]   [ Change vs Last Week ]
[ Top Category ]   [ Most Active Area ]


------------------------------------------------------
|                 INTERACTIVE MAP                    |
|       Resource Demand by Tract/Neighborhood        |
|  Layers: 311 | Code | Notices | (Future: 911)      |
------------------------------------------------------

NEIGHBORHOOD / TRACT SUMMARY (Panel)

- Signals per 10k residents
- City baseline comparison (% above/below)
- Top issue category
- Weekly trend (▲/▼/→ with text)


------------------------------------------------------
| TODAY IN MONTGOMERY (Live Digest)                  |
| • Council agenda published                         |
| • Zoning hearing scheduled                         |
| • Road closure announced                           |
|  [each item links to source]                       |
------------------------------------------------------

TREND INSIGHTS

• Infrastructure complaints up 12%
• Sanitation requests rising in west districts
• Service requests decreasing downtown

## Map Interaction Design
- **Map Library**: Leaflet.js
- **Default view**: City boundary visible, polygons shaded by signals per 10k residents.
- **Layer toggles**: 311 requests, code violations, infrastructure issues, public notices.
- **Region click**: Opens tract summary with baseline comparison and trends.

## Accessibility Design (WCAG 2.1 AA)
- Keyboard navigation
- Visible focus states
- "Skip map" link
- Screen reader alternative (Neighborhood List/Table)
- Non-color indicators
- High contrast palette

## Color System
- **Navy**: Primary UI
- **River Blue**: Data layers
- **Golden Sunrise**: Highlights
- **Heritage Green**: Positive signals
