# JetStash Completed Work Ledger

This file is append-only. A task listed here is `DONE` and should not be proposed again unless new
evidence shows a regression, changed requirement or stale external fact.

## July 2026

| ID | Completed work | Evidence | Production state |
|---|---|---|---|
| `TRUTH-001` | Rebuilt the public homepage around “Before you book, get a second opinion.” | Repository verified: commits through `61c616b` | Live |
| `SEC-001` | Upgraded Next.js to the reviewed patched `15.5.21` maintenance release. | Repository verified: `c81a6bc`, merged through PR #2 | Live |
| `TRUTH-002` | Prevented verification-pending route facts leaking across public route, deal, airport, destination and metadata surfaces. | Repository verified: `8b080f6`, merged through PR #2 | Live |
| `ROUTE-001` | Added the Birmingham-to-Mumbai connecting-route guide using primary-source evidence and no invented fares, airlines or frequencies. | Repository verified: `608db7c`, merged through PR #2 | Live |
| `TRUTH-003` | Kept destination guidance and airport notes off route pages; aligned fare-empty states and Route Watch language with the data and actual manual workflow. | Repository verified: `6f6f98e` and `5e09453`, merged through PR #2 | Live |
| `SHARE-001` | Removed duplicated “direct” wording and nested parentheses from direct-route WhatsApp share text. | Repository verified: `3d3adbb`, merged through PR #3 | Live |
| `STATUS-001` | Added the append-only, evidence-backed Route Status V1 ledger and fail-closed derivation. | Repository verified: `2bd97c2`, merged through PR #4 | Live |
| `STATUS-002` | Shipped Route Status presentation across the homepage and route surfaces, ISR coverage, evidence validation and airline suppression. | Repository verified: `c48f387`, merged through PR #4 | Live |
| `STATUS-003` | Standardised customer-facing Route Status dates in UK long-form and added regression coverage. | Repository verified: `7eee01d`, merged through PR #4 | Live |
| `VIS-001A` | Added the dark Manchester-to-Mumbai homepage journey visual and pull interaction. | Repository verified: `63a1515`, merged through PR #5 at `498f980` | Live |
| `VIS-002` | Added the consistent, dark editorial Guide image collection across all nine guide pages. | Repository verified: `c825dd9` and `5fb2d5d`, merged through PR #10 at `0c3bffe` | Live |
| `READY-001` | Built and shipped Travel Ready Check with official-source rules, freshness dates and honest unsupported-combination behaviour. | Repository and production verified; see `JETSTASH_PRINCIPLES.md` §14.3 | Live |
| `WATCH-001` | Connected Travel Club and Route Watch to Brevo, created the required attributes and live-tested signup storage. | Repository verified in `README.md`; production test recorded there | Live |
| `LEADS-001` | Connected quote-request and contact routes to the real inbox workflow. | Repository verified in `README.md` | Live |
| `OPS-001` | Completed the production operational verification of the customer submission flows. | Founder confirmed on 24 July 2026. Durable per-flow evidence was not added to this ledger. | Treat as complete; re-test only after a relevant change |
| `FOUNDER-001` | Protected the Founder Dashboard from production access and indexing. | Production verified: `/founder` returned HTTP 404; source gating and robots rules reviewed | Live |
| `PHOTO-001` | Completed destination photography using the JetStash Signature Collection direction. | Founder confirmed | Live |
| `PC-001` | Added permanent project-control status, completed, roadmap and decision records and made them mandatory reading for future agents. | Repository and production verified: PR #6, merge `4dae272` | Live |
| `DOC-001` | Reconciled the three core documents with Next.js `15.5.21`, the current Vitest suite, Route Status ownership, homepage ISR architecture and the automatic Vercel workflow. | Repository verified; 439/439 tests passed across 16 files on 24 July 2026 | Live |
| `TRC-001` | Improved Travel Ready Check discoverability through contextual links in document and visa surfaces, the homepage, footer and sitemap, without main-navigation clutter. | Repository verified: `db12797`, `fa7734b`, `072c041`; 457/457 tests passed and Vercel Preview succeeded | Live |
| `BRAND-001` | Repositioned JetStash as UK travel intelligence for international journeys, while retaining South Asia and Gulf route depth as explicit specialist coverage. | Repository verified: `05f47d6`; 475/475 tests passed, Vercel Preview and production smoke tests succeeded | Live: merged through PR #12 at `24fc761` |
| `GUIDE-001` | Made the Guides hub visually discoverable with a compact editorial hero and image-led guide cards, preserving the international positioning copy. | Repository verified: `ccd12ca`, `feb579d`, `d021a95`; 480/480 tests passed, Vercel Preview and production smoke tests succeeded | Live: merged through PR #13 at `68d4cd2` |
| `TRUTH-004` | Closed the July live-site trust cracks: removed duplicated SEO titles, stopped deal cards borrowing airport-specific durations from generic destination data, and replaced destination schedule claims with neutral airport-specific guidance. | Repository verified: PR #20, merge `53504e0`; 531/531 tests passed, production build and live smoke checks succeeded | Live |
| `STATUS-004` | Made the homepage flagship choose a cinematic showcase or immediate advisory state from the shared Route Status ledger, with editorial route selection kept separate from operational facts. | Repository verified: PR #20, merge `53504e0`; 531/531 tests passed, Vercel Production deployment Ready | Live |
| `FARE-METHOD-001` | Finalized the editorial fare observation methodology: versioned per-route observation profiles, a fixed 8-week booking horizon (grounded in existing routes' own stated booking-window guidance, not invented), GBP-only policy, and required `observedVia`/`profileId`/`observationReason` fields on new `FareObservation` records. Methodology only — building the archive itself under it is `FARE-001`, still active with zero logged observations. | Repository verified: PR #22, merge `0d87436`; 531/531 tests passed, typecheck/lint/build clean | Live |
| `DOC-002` | Restructured `docs/visual-identity.md` from a photography-only guide into a four-part visual design system (Visual Principles, Editorial Photography, Interactive Visual Systems, Asset Catalogue) with Lifecycle status per entry, a Design Decisions appendix, a documentation audit, and a new `VISUAL_REVIEW_CHECKLIST.md`. Documentation structure only — the audit it introduced found 10 of 15 hero briefs and 10 of 11 UK airports still unphotographed (`VIS-001`, unaffected, still active). | Repository verified: PR #23, merge `943a00b`; 531/531 tests passed, typecheck/lint/build clean | Live |

## Earlier foundations retained

- Custom Next.js platform replaced the GoDaddy Airo site.
- Signature Collection replaced generic stock photography.
- Journey Brief evolved from the original travel-guide concept.
- Travel Ready Check evolved from the original document-checker concept.
- The Manchester route experience evolved from the original simple airport-list concept.

## Re-verification rule

Completion does not make changing external facts permanently true. The following must be rechecked
when due even though the underlying feature is complete:

- airline schedules and service-status evidence;
- passport and visa rules;
- fare observations;
- affiliate destinations and deep links; and
- external provider credentials or attributes after an account/configuration change.
