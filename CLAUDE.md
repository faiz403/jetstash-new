# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

JetStash — a Next.js 14 (App Router) marketing/content site for a UK travel hub covering Pakistan, India, the Gulf, Umrah, family holidays and business class, plus Mediterranean/North African routes. There is no database or CMS: all content (destinations, routes, airports, example fares) lives in typed TypeScript data files under `/data`. Pages are statically generated from that data.

## Keep JETSTASH_PRINCIPLES.md current

`JETSTASH_PRINCIPLES.md` (repo root) is the long-form handbook: architecture, content model,
design system, affiliate strategy, content-integrity rules, deployment process, and the reasoning
behind past decisions. Before any significant architectural change, check whether it needs
updating. If the change alters a long-term business decision, a coding standard, the affiliate
strategy, a design principle, or an architectural rule, update the relevant section of the handbook
**in the same PR** as the code change — not as a follow-up. Do **not** touch it for temporary
experiments, one-off content edits, or ordinary bug fixes; it documents standing decisions, not
day-to-day changes.

## Commands

```bash
npm install
npm run dev      # localhost:3000
npm run build    # production build — this is the real correctness check, since ESLint is disabled during builds
npm run start
npm run lint
```

There is no test suite. TypeScript's `strict: true` plus `npm run build` is the primary correctness signal — always run a build after non-trivial changes to data files or page components. Note `next.config.js` sets `eslint: { ignoreDuringBuilds: true }`, so `next build` will not catch lint issues; run `npm run lint` separately if relevant.

## Architecture

**Content model (`/data`)** — five typed arrays are the single source of truth, cross-referenced by slug rather than nested objects:
- `data/airports.ts` — UK departure airports (`Airport`), keyed by `slug`.
- `data/destinations.ts` — destinations grouped by `RegionGroup` (`pakistan`, `india`, `gulf`, `mediterranean`, `north-africa`). Umrah destinations (Jeddah, Madinah) use `region: 'gulf'` — the `/umrah` hub page filters `regionGroups.umrah.destinationSlugs` (in `lib/site-config.ts`) rather than relying on a distinct region value. Each `Destination` optionally carries `familyVisitContent` for destinations where visiting relatives is a primary travel pattern.
- `data/deals.ts` — curation only (`Deal`): which airport→destination+cabin combos are worth featuring as a card, plus display metadata (city/country, airline, category tag). Deliberately carries no price field — see below.
- `data/fare-observations.ts` — the append-only fare history log (`FareObservation`) that's the *only* source of truth for prices shown on deal cards. `DealCard` derives an honest observed range (or a single logged check) from this via `getFareRangeSummary(routeSlug, cabin)`; when nothing has been logged yet for a route+cabin, the card falls back to non-perishable route facts instead of a price. Never overwrite an entry when a fare changes — append a new one with a later `observedDate` so the trend stays visible.
- `data/routes.ts` — specific airport→destination route guides (`Route`), with fields modelling *time-bound* direct service (`directServiceEndDate`/`directServiceEndNote`) and connecting alternatives (`connectingAlternative`) so a route can be described honestly as service changes over time (see README's "Time-bound direct services" section for the exact update procedure when a withdrawal date passes).

Each data file exports lookup helpers (e.g. `getRoutesByDestination`, `getDealsByRegionGroup`, `getAirportBySlug`) — use these instead of filtering the raw arrays inline.

**Book-By Countdown** (`lib/booking-intelligence.ts`) — the hero feature: festival-anchored booking guidance ("book by 14 February") for five priority routes only (`BOOK_BY_PRIORITY_ROUTE_SLUGS` in that file). It's the *only* place that computes a booking state or book-by date — every surface (`components/route/book-by-countdown.tsx`, `booking-moment-strip.tsx`, `next-travel-moment-ribbon.tsx`, the route-map's brass indicator) calls into it rather than deriving dates itself. Dates come from `data/peak-period-dates.ts` (verified, precision-tagged — Islamic dates are astronomical estimates and every render keeps that visible) and `data/booking-windows.ts` (restructured from each route's own stated prose). Never a live-price claim or a predicted price — see JETSTASH_PRINCIPLES.md §14 for the full standing rules and §14.1 for the architecture.

**Travel Ready Check** (`lib/travel-ready-check.ts` + `data/travel-ready-rules.ts`) — answers "can I actually travel on these dates with the documents I have?", the connected-but-different question to Book-By's "when should I book?". `data/travel-ready-rules.ts` is the *only* place a visa or passport fact lives — no visa/passport logic exists anywhere else in the codebase; `lib/visa-links.ts`'s per-country official link stays a separate, simpler pointer. Every rule carries an official source (GOV.UK or the destination's own visa portal, never a blog), a `lastVerifiedDate`, and a `reviewDueDate` — once that passes, `isRuleStale()` makes the affected check degrade to "official confirmation required" automatically rather than silently going stale. V1 covers 7 countries (Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey, Morocco), British passport holders plus NICOP/POC and OCI document holders — every other combination returns an honest `not-enough-information`, never a guess. It plugs into the Travel Intelligence Engine (`lib/travel-intelligence-engine.ts`) via `computeReadiness()`'s optional 3rd parameter rather than existing as a separate tool — see JETSTASH_PRINCIPLES.md §14.2 for the engine and §14.3 for this module.

**Fare freshness** (`lib/freshness-thresholds.ts`) — the single place every "how old is too old" number lives (`OBSERVATION_FRESH_DAYS`, `OBSERVATION_STALE_DAYS`, `SERVICE_END_WATCH_DAYS`, `RULE_REVIEW_WATCH_DAYS`) plus `getFareFreshnessState()`'s 3-tier `'fresh' | 'ageing' | 'stale'` model. Every fare-rendering component (`deal-card.tsx`, `fare-history-panel.tsx`, `book-by-countdown.tsx`) imports thresholds from here rather than defining its own — never hardcode a day-count elsewhere. See JETSTASH_PRINCIPLES.md §14.4 for the full reasoning, including why automated fare collection isn't currently safe and what the weekly Vercel Cron (`app/api/cron/fare-check-reminder/route.ts`) does instead.

**Analytics** (`lib/analytics.ts`) — the one `track()` wrapper every event goes through, backed by `@vercel/analytics`/`@vercel/speed-insights` (mounted in `app/layout.tsx`). Never call the vendor SDK directly from a component; never send anything that identifies a person or a document. Event catalog is in JETSTASH_PRINCIPLES.md §14.4.

**Routing (`/app`)** — App Router with static generation:
- Region hub pages (`app/pakistan`, `app/india`, `app/gulf`, `app/umrah`, plus `app/family-holidays`, `app/business-class`) are thin pages that pass region-specific copy/data into the shared `RegionHubPage` template (`components/sections/region-hub-page.tsx`).
- `app/destinations/[slug]`, `app/routes/[slug]`, `app/airports/[slug]` are dynamic pages using `generateStaticParams` against the corresponding `/data` array.
- `app/api/subscribe`, `app/api/route-watch` (Brevo), `app/api/contact` and `app/api/quote-request` (Resend) are the only server logic — all four **fail clearly with a 503** if their env vars aren't set, rather than silently succeeding. Don't change that fail-clear behavior without discussing it. Option lists these endpoints validate live in shared `lib/*-options.ts` modules (`quote-request-options`, `route-watch-options`, `travel-club-options`) or come from the `/data` lookup helpers — never re-declare a literal list of valid values inside an API route. The two Brevo routes' custom contact attribute names come from `lib/brevo-attributes.json`/`lib/brevo-attributes.ts` (`BREVO_ATTRIBUTE_NAMES`) — never hardcode an attribute name as a literal object key. Run `npm run brevo:setup` after adding a new attribute there; env vars being set does not mean the attributes exist in Brevo's own dashboard — Brevo silently drops unrecognised attributes rather than erroring, so this can go stale invisibly (it did — see git history).

**Design system** — all brand colours (`ink`, `brass`, `terracotta`, `sand`), type and spacing are defined once in `tailwind.config.js` and `app/globals.css`. Never hardcode hex values or magic spacing numbers elsewhere (the only exceptions: WhatsApp's brand green in `whatsapp-share-button.tsx`, and `app/**/opengraph-image.tsx` files, which mirror the palette because ImageResponse can't read Tailwind); if the palette needs to change, that's the only file to touch. Fonts: Fraunces (display/serif, `font-display`) + Public Sans (body, `font-sans`) via `next/font/google`, wired up in `app/layout.tsx` — Fraunces deliberately ships no italic face (nothing uses it; don't re-add without a callsite).

**Interaction language** — one hover/press vocabulary site-wide: solid conversion CTAs (form submits, partner links) hover to brass (`hover:bg-brass-400` + `hover:shadow-brass-glow` on brass buttons, `hover:bg-brass-600` on ink buttons) and compress on press (`active:scale-[0.985]`); dark navigational buttons hover `bg-ink-700`; destination panels inside `group` cards zoom `group-hover:scale-[1.03]` over 500ms. Every dark hero opens with the same arrival moment: `relative overflow-hidden`, the brass radial-gradient overlay, and `stagger-in stagger-N animate-fade-up` on badge → h1 → intro. Match these on any new surface rather than inventing variants.

**Images** — one central brand-image system (`docs/visual-identity.md` is the art-direction source of truth). Real photography lives in `public/images/{heroes,destinations,airports,guides}/` named by slug/key; `scripts/generate-image-manifest.mjs` (prebuild/predev) scans it into `lib/image-manifest.json`, and `lib/brand-images.ts` resolves lookups against that manifest. Render only through `<DestinationVisual />` (cards/panels) and `<HeroBackdrop />` (dark heroes) — both fall back automatically to the generated `<DestinationMark />` panel / brass radial gradient when no file exists, so adding or removing an image is a file-drop plus deploy, never a code change. Zero external image requests either way.

**Path alias** — `@/*` maps to the repo root (see `tsconfig.json`).

## Content integrity constraints

This codebase treats fabricated content as a bug class, not a style preference — several conventions exist specifically to prevent it:

- **No invented stats or urgency.** Every claim must be traceable to an editable data file or explicitly marked as a placeholder/example (see README "No fabricated content").
- **Route claims must be verified against real airline schedules**, not assumed from a brief — see README "Verified route and airport claims" for two routes (Leeds Bradford–Islamabad; Manchester–Jeddah/Birmingham–Madinah) that were deliberately modelled as connecting rather than direct after conflicting source data. Apply the same standard to any new entry in `data/routes.ts` or `data/airports.ts`.
- **Deal cards never show a hardcoded price.** `Deal` (`data/deals.ts`) is curation metadata only — which airport→destination+cabin combos to feature — with no price field. `DealCard` derives what to show from `data/fare-observations.ts` (`getFareRangeSummary`) at render time: an honest observed range or single logged check when observations exist, or non-perishable route facts (flight time, direct/connecting, booking-window link) when none do. Never add a price field back onto `Deal` or hardcode a `£` figure in a component — log a new entry in `data/fare-observations.ts` instead (append-only, never overwrite).
- **Deliberately unbuilt features** (Hotels, Car Hire, Airport Lounges, Airport Parking) are a considered scope decision, not an oversight — see README "Deliberate scope decisions" before adding placeholder content for these verticals.
- **Travel Club / fare alerts** (`app/travel-club/page.tsx`, `components/sections/newsletter-section.tsx`) promise manual, human-curated email segments (by `TRAVEL_INTEREST` and `NEAREST_AIRPORT` Brevo attributes) — not automated price tracking, which doesn't exist. Don't let UI copy imply otherwise. See README "Running Travel Club" for the full operational model, and `docs/travel-club-email-sequence.md` for the actual email copy.

## Required before production launch

The README's "Required before launch — read this" section lists concrete unfinished items (real build verification, real photography, Brevo/Resend env vars, real fare data, affiliate tracking IDs, periodic business-class URL date refresh). Check there before assuming any of these are done.
