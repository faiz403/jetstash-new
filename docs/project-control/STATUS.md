# JetStash Current Status

**Last reconciled:** 24 July 2026

**Production branch:** `main`

**Application release baseline:** `498f980425b2907d09544e80244cba0a88a3b2d7`

**Production site:** `https://jetstash.co.uk`

## Current truth

- Route Status V1 is shipped and live.
- The Manchester-to-Mumbai homepage visual is shipped and live.
- The Birmingham-to-Mumbai connecting guide and verification-pending leakage protection are live.
- Travel Ready Check is built and live.
- Route Watch and Travel Club use honest, human-reviewed language.
- The Founder Dashboard is unavailable in production and non-indexable.
- Operational submission flows were founder-confirmed as already tested; do not repeat the entire
  audit unless a relevant API route, environment variable or provider configuration changes.
- Destination photography is founder-confirmed complete.
- Permanent project-control records are linked from `CLAUDE.md` and `README.md`.
- `CLAUDE.md`, `README.md` and `JETSTASH_PRINCIPLES.md` reflect Next.js `15.5.21`, the current
  Vitest suite, Route Status ownership, homepage architecture and automatic Vercel deployment.

## ACTIVE

No implementation task is currently active.

## NEXT

### TRC-001 — Improve Travel Ready Check discoverability

Audit existing entry points before changing anything. Add only the highest-value links from the
homepage, footer and relevant route/destination surfaces. Do not clutter the main navigation.

## QUEUED

- `FARE-001` — add fresh, dated, manually verified fare observations for priority routes.
- `VIS-001` — complete premium photography for supported UK airports.
- `VIS-002` — create a consistent premium hero-image collection for travel guides.
- `AFF-001` — review Expedia, booking partners, CJ opportunities and luggage partners.
- `CONV-001` — use real analytics to test homepage conversion hierarchy; no redesign based only on
  opinion.
- `ARR-001` — research and specify Arrive By for urgent, deadline-critical travel without making
  unsupported schedule or arrival promises.

## Do not reopen without new evidence

- The July 2026 operational form/email audit.
- Verification-pending route leakage.
- Birmingham-to-Mumbai route creation.
- Direct-route WhatsApp punctuation.
- Route Status V1 foundation, presentation and date formatting.
- The Manchester-to-Mumbai homepage visual.
- Founder Dashboard production protection.
- Destination photography.

## Known risks

- Genuine fare intelligence remains thin and must never be filled with invented prices.
- TravelUp deep linking remains disabled until a destination URL is verified manually.
- Travel Ready rules and Route Status evidence require scheduled re-verification as source facts
  change.
- Homepage conversion quality cannot be claimed from visual review alone; it requires real funnel
  data.
