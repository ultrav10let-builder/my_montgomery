# Deployment Architecture

- **Frontend**: Vercel
- **Backend**: Render or Railway

## Repo Structure
```
my-heart-montgomery/
  apps/
    web/
    api/
  data/
    latest_signals.json
    digest_today.json
    sample/
      latest_signals.sample.json
      digest_today.sample.json
  connectors/
    montgomery/
      sources.md
      mappings.md
  docs/
    PRD.md
    MVP.md
    ARCHITECTURE.md
    UI_WIREFRAME.md
    REBUILD.md
    ACCESSIBILITY.md
    SECURITY.md
  .env.example
  package.json
```

## Demo Flow for Judges
1. **Snapshot**: Loads live civic signals + timestamp.
2. **Map**: Displays resource demand distribution (per 10k).
3. **Interaction**: Click tract → panel shows trends + baseline.
4. **Digest**: "Today in Montgomery" shows Bright Data-powered digest.
5. **Accessibility**: Proof of keyboard navigation + skip link.
