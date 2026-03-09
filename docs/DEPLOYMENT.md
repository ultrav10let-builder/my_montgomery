# Deployment Architecture

- **Frontend**: Vercel (static build via `vite build`)
- **Backend**: Render or Railway (Node.js, `npm start`)

## Repo Structure
```
my_montgomery/
  src/               # React app (Vite)
  server/            # Express API, services, connectors
  data/              # SQLite DB, optional JSON fallbacks
  connectors/
    montgomery/      # source mappings
  docs/
    PRD.md, MVP.md, ARCHITECTURE.md, SOURCES.md,
    UI_WIREFRAME.md, REBUILD.md, ACCESSIBILITY.md, SECURITY.md
  .env.example
  package.json
  server.ts          # Entry point (Express + Vite middleware)
```

## Demo Flow for Judges
1. **Snapshot**: Loads civic signals, scoped metrics, AI summary, and the system status strip.
2. **Map**: Displays signal points plus district overlays, category filtering, and primary map modes (`pressure`, `calls`, `resources`).
3. **Interaction**: Click a district on the map, or use the district dropdown, to update the District Insight panel with scoped totals, approximate per-10k context, citywide baseline comparison, prior-window change, and leading neighborhoods.
4. **Support Rail**: "Today in Montgomery," Live Traffic, and City Pulse stay grouped in the right rail for the demo flow.
5. **Accessibility**: Skip link, semantic landmarks, labeled controls, digest pause/resume, and keyboard district-selection fallback are in place; formal 508 certification is still out of scope.
