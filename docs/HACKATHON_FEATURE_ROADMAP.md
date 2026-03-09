# Hackathon Feature Roadmap

## Vision

**My❤️Montgomery** is evolving from a civic dashboard into a **city intelligence platform** that helps residents, journalists, and city leaders understand what is happening now, what is changing, and what needs attention next.

For the hackathon, the roadmap centers on **two standout upgrades** designed to feel credible, useful, and demo-worthy:

1. **Live Civic Timeline Engine** — a robust event lifecycle system for active, scheduled, ongoing, and resolved city events
2. **Compare to Previous Period** — a true before-vs-after civic intelligence experience, not just a percentage toggle

---

## Flagship Upgrade 1 — Live Civic Timeline Engine

### Demo headline
**"The map understands time, not just data."**

### Why it matters
Today, many civic systems treat all events like they age the same way. That creates a bad live map experience.

This upgrade turns the platform into a true time-aware city view:

- crashes clear quickly
- roadwork stays visible while ongoing
- scheduled civic events appear before they start
- completed items disappear for the right reason
- every item has a lifecycle that can be explained

### Resident impact
- Residents can see what is **active now**, **starting soon**, and **still ongoing** in their part of the city.
- The map becomes more trustworthy because it reflects how real life works.

### City impact
- Staff can distinguish **temporary spikes** from **persistent operational issues**.
- Long-running closures, service problems, and recurring events become easier to monitor and communicate.

### What “robust” means
- Normalize event timing at ingestion, not only at read time
- Store lifecycle fields like `starts_at`, `ends_at`, `expires_at`, `status`, `policy`, and `confidence`
- Add source-specific timing parsers for 511, city notices, construction updates, and meeting/event sources
- Create dedicated live-event endpoints for:
  - active now
  - upcoming soon
  - ending soon
  - recently resolved
- Show lifecycle status in the UI:
  - Scheduled
  - Active
  - Ending Soon
  - Resolved
- Explain **why** an item is on the map and **when** it will leave

### Wow-factor UX ideas
- countdown badge: "Ends in 2h"
- status chips: `Scheduled`, `Active`, `Ongoing`, `Cleared`
- hover details: "Visible because source lists roadwork through Friday"
- timeline strip for the next 24–72 hours of city events and disruptions

### Delivery phases
#### Phase A — Strong backend foundation
- normalized lifecycle fields
- dedicated live/upcoming/resolved APIs
- policy + confidence scoring
- source-aware timing extraction

#### Phase B — Public-facing experience
- lifecycle labels on map markers and cards
- upcoming/active toggle
- explanations for start/end timing
- clearer marker persistence logic

#### Phase C — City operations layer
- admin controls for lifecycle rules
- audit/debug panel for why an item is active
- recurring issue detection for corridors and districts

### Hackathon story
This turns the product from a static incident viewer into a **living civic timeline** — a city map that knows the difference between a crash, a detour, a road closure, and a scheduled public event.

---

## Flagship Upgrade 2 — Compare to Previous Period

### Demo headline
**"Don’t just show what happened. Show what changed, where, and why it matters."**

### Why it matters
Most dashboards stop at raw counts. This feature makes the platform useful for real decisions.

Instead of just saying:
- "Traffic is up 12%"

the platform should say:
- where the increase happened
- which categories drove it
- whether it is a short-term spike or persistent pattern
- which districts improved
- what residents and city staff should pay attention to next

### Resident impact
- "What changed in my neighborhood?"
- "Is my area getting better or worse this week?"
- "What is new since the last period?"

### City impact
- identify worsening corridors, recurring hotspots, and unresolved issue clusters
- compare intervention periods before and after changes
- track whether pressure is moving citywide or concentrated in one district

### What a full-featured comparison should include
- equal-window comparisons:
  - 7d vs previous 7d
  - 30d vs previous 30d
  - custom range vs prior equal-length range
- category movers:
  - biggest increases
  - biggest decreases
  - persistent high-volume categories
- district and neighborhood movers
- current vs previous map overlays
- delta view for roads, districts, and neighborhoods
- persistent hotspot detection
- plain-language summaries of the change
- drilldown tables for analysts and city staff

### Wow-factor UX ideas
- **Momentum cards**: rising, easing, persistent, newly emerging
- **Delta map mode**: show where activity intensified or cooled down
- **Neighborhood change stories**: "District 3 improved overall, but closures remained elevated near Eastern Blvd"
- **Insight rail**: "Most of this week’s increase came from ongoing roadwork, not new incidents"

### Delivery phases
#### Phase A — Comparison MVP
- fully wire compare toggle to prior equal-length window
- category and district movers
- plain-language summary cards
- zero-baseline handling and cleaner trend math

#### Phase B — Visual intelligence
- delta map mode
- hotspot persistence view
- compare cards for active vs resolved items
- top corridor and neighborhood movement views

#### Phase C — Decision-support layer
- before/after intervention analysis
- recurring issue detection
- exportable comparison snapshots for staff reports and public updates
- AI-assisted narrative summaries backed by real data

### Hackathon story
This transforms a standard dashboard feature into a **civic momentum engine** — showing not just where the city is, but whether it is improving, worsening, or staying stuck.

---

## Why these two upgrades matter together

These features complement each other:

- **Live Civic Timeline Engine** explains what is happening now and what is still ongoing
- **Compare to Previous Period** explains how conditions are changing over time

Together, they create a product that can answer both:

- **"What is happening in Montgomery right now?"**
- **"Is Montgomery improving or getting worse compared to before?"**

That combination is powerful for residents, city leadership, journalists, and civic advocates.

---

## Hackathon-ready positioning

### What judges should remember
- This is not just a dashboard — it is a **time-aware civic intelligence platform**
- It combines **live visibility** with **historical context**
- It serves both **public transparency** and **city operations**

### Memorable product language
- **Live Civic Timeline Engine**
- **Montgomery Momentum Compare**
- **From signals to action**
- **Your City. Clearly Seen. Over Time.**

### Success metrics
- more accurate live-map visibility for ongoing events
- clearer resident trust in what counts as active vs resolved
- meaningful comparison insights by district, neighborhood, and category
- stronger demo narrative for city stakeholders and hackathon judges

---

## Recommended build order

1. Finish lifecycle normalization and live event APIs
2. Build comparison MVP with real previous-period intelligence
3. Add delta map mode and lifecycle status UX
4. Add hotspot persistence, exports, and AI insight narration

This sequence gives the project both a stronger technical core and a more impressive story on stage.