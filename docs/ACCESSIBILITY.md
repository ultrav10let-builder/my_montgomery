# Accessibility Status

This document captures the current accessibility posture of My❤️Montgomery as of March 9, 2026.

## Current Position

My❤️Montgomery has several meaningful accessibility improvements in place and is in a better position for **508-aligned demo readiness** than earlier versions of the app.

However, this should **not** be described as formal Section 508 certification or a completed accessibility audit.

## Implemented Accessibility Patterns

- Skip link to main content
- Semantic page landmarks (`header`, `main`, `footer`)
- Visible focus styles on key controls
- Time range controls exposed as a button group instead of faux tabs
- Compare toggle exposed as a `switch`
- Explicit labels for custom date inputs
- Digest filter controls exposed as pressed buttons instead of faux tabs
- Pause / resume control for auto-rotating digest content
- Keyboard-accessible district dropdown fallback for map scoping
- Always-mounted district insight panel to reduce layout shift and preserve context

## Known Limitations

- No formal screen-reader audit has been completed
- No formal color-contrast audit is documented here
- No full zoom/reflow audit is documented here
- Leaflet map shapes themselves are still pointer-first; the district dropdown is the keyboard fallback
- Dynamic announcement behavior for all async/dashboard updates has not been fully audited

## Verification Notes

The latest accessibility-oriented pass was validated with:

- focused component tests for time controls and digest controls
- TypeScript linting (`npm run lint`)
- production build verification (`npm run build`)

## Recommended Honest Language

Use wording like:

- "Accessibility improvements are implemented in the main dashboard flow, including keyboard-accessible district selection fallback and pause controls for rotating content."
- "The app is in a stronger 508-aligned state, but it has not undergone a formal compliance audit or certification process."
