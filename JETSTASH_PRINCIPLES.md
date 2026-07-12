# JetStash Principles Handbook

A single reference for how JetStash is built, why it's built that way, and the rules that keep
future changes consistent with what's already here. This is not a duplicate of `README.md` (which
is the operational launch checklist) or `CLAUDE.md` (the terse agent-facing brief) — it's the
longer-form "why" behind both, written for anyone (human or agent) picking up work on this
codebase without prior context. Where a rule has a canonical source file, this document points to
it rather than forking a second copy that can drift.

**Read this alongside:** `CLAUDE.md` (quick agent brief), `README.md` (launch checklist, env vars,
data model conventions), `docs/visual-identity.md` (photography system), `docs/travel-club-email-sequence.md`
(manual email templates).

---

## 1. What JetStash is

A Next.js 14 (App Router) content and lead-generation site for UK travellers flying to Pakistan,
India, the Gulf, on Umrah trips, and to the wider Mediterranean/North Africa — with dedicated
verticals for family visits and business class. There is **no database and no CMS**. Every fact on
the site — every airport, destination, route, fare, warning, and tip — lives in a typed TypeScript
array under `/data`, and pages are statically generated from that data at build time.

Two business models sit on top of that content:
1. **Affiliate commission** on outbound flight-booking clicks (TravelUp via Commission Junction).
2. **Manual lead capture** for Umrah/family/group trips and a curated (not automated) "Travel Club"
   fare-alert mailing list.

There's also a private, unlinked `/founder` route — a self-auditing dashboard that reads the same
`/data` files the public site does and reports what's broken, what's leaving money on the table,
and what's just polish. It exists so operational state ("is the newsletter wired up?", "which
routes have no fare data?") is always derived from real code/env state, never a stale mental model.

## 2. Stack & commands

- **Next.js 14.2** (App Router), **React 18**, **TypeScript 5** (`strict: true`)
- **Tailwind CSS 3** with a fully custom token system (no default palette in use)
- **Fraunces** (display serif) + **Public Sans** (body) via `next/font/google`
- `lucide-react` for icons, `clsx` + `tailwind-merge` (via `lib/utils.ts`'s `cn()`) for class merging
- No ORM, no database client, no auth library — there is nothing to run except `next dev`/`next build`

```bash
npm install
npm run dev      # localhost:3000 — runs generate-image-manifest.mjs first (predev hook)
npm run build    # THE real correctness check — ESLint is disabled during builds (next.config.js)
npm run lint     # run separately; next build will not catch lint issues
npm run start
```

There is no test suite. `strict: true` TypeScript plus a real `npm run build` is the primary
correctness signal for any non-trivial change to `/data` or page components.

**Windows-specific build trap:** always build from the correctly-cased path
(`C:\Users\<you>\Documents\...`, capital D). A lowercase-`documents` working directory makes
webpack resolve two differently-cased copies of every module, loading React twice and failing
prerendering with `Cannot read properties of null (reading 'useContext')`.

## 3. Repository layout

```
app/            Routes (Next.js App Router) — see §5
components/
  ui/           Button, Badge, DealCard, HubCard, DestinationVisual, DestinationMark,
                HeroBackdrop, NoFareFallback, RouteStat, Logomark — shared primitives
  layout/       Header, Footer
  sections/     PageHero, RegionHubPage (shared template for pakistan/india/gulf/umrah),
                RouteMapHero, NewsletterSection, ContactForm, QuoteRequestForm,
                DealsExplorer, FamilyVisitBlock
  route/        WarningBanner, RouteTimeline, FareHistoryPanel, BookingWindowPanel,
                TravellerTipList, CommunityNotesPanel, RouteWatchForm, WhatsappShareButton
  seo/          JsonLd + schema builders
data/           Typed content arrays — the single source of truth. See §4.
lib/
  site-config.ts          Nav structure, region groupings, site metadata, contact email
  booking-providers.ts    Affiliate/booking-link architecture — see §7
  brand-images.ts         Image manifest resolver — see §6.4
  email.ts                Brevo/Resend HTTP helpers used by the four API routes
  utils.ts                cn() className merge helper
  quote-request-options.ts, route-watch-options.ts, travel-club-options.ts
                           Shared option lists + validators for form/API pairs — see §8
  visa-links.ts            Official government visa/entry-requirement links, one per country
  founder-insights.ts      Derives every /founder section from /data + env — see §10
  image-manifest.json      Generated file — do not hand-edit (see scripts/)
scripts/
  generate-image-manifest.mjs   Scans public/images/** into lib/image-manifest.json
                                  (prebuild/predev hook)
docs/
  visual-identity.md              Photography art direction + naming convention
  travel-club-email-sequence.md   Manual email templates for Travel Club
public/images/{heroes,destinations,airports,guides}/   Real photography, by slug/key
```

**Path alias:** `@/*` maps to the repo root (`tsconfig.json`).

## 4. Content model (`/data`)

Fourteen typed arrays, cross-referenced by **slug**, never nested. Current volumes: 24
destinations, 26 routes, 11 UK airports, 9 guides.

| File | Exports | Purpose |
|---|---|---|
| `airports.ts` | `Airport`, `getAirportBySlug` | UK departure airports. `compareAirportSlugs` names a realistic alternative for airports with no curated direct route. |
| `destinations.ts` | `Destination`, `RegionGroup`, `getDestinationBySlug` | All destinations across `pakistan`/`india`/`gulf`/`mediterranean`/`north-africa`. Umrah destinations (Jeddah, Madinah) use `region: 'gulf'` — the `/umrah` hub filters by `regionGroups.umrah.destinationSlugs` in `site-config.ts`, not a distinct region value. `familyVisitContent` is optional, present only where visiting relatives is a primary travel pattern. |
| `routes.ts` | `Route`, `getRouteByAirportAndDestination`, `getRoutesByDestination`, `getRouteAirport`, `getRouteDestination` | Airport→destination route guides. `directServiceEndDate`/`directServiceEndNote` model a currently-direct service with an announced end date; `connectingAlternative` describes the realistic 1/2-stop fallback. See §4.1. |
| `deals.ts` | `Deal`, `DealCabin`, `DealCategory`, `getDealsByRegionGroup` | Curation only — which airport→destination+cabin combos to feature as a card. **No price field, deliberately** — see §4.2. |
| `fare-observations.ts` | `FareObservation`, `getObservationsByRoute`, `getLatestObservation`, `getFareRangeSummary` | Append-only fare history — the *only* source of truth for any price shown anywhere. |
| `airlines.ts` | `Airline`, `getAirlineBySlug`, `getAirlinesBySlugs` | Canonical airline reference. `Route.airlineSlugs` references this instead of retyping names. |
| `peak-periods.ts` | `PeakPeriod`, `getPeakPeriodsByIds` | Canonical demand-period reference (Eid, Diwali, UK school holidays, wedding season...). `Route.peakPeriodIds` / `FamilyVisitContent.peakPeriodIds` reference this. |
| `route-timeline.ts` | `RouteTimelineEvent` | Append-only, dated history of real changes to a route (launch, withdrawal, frequency change). |
| `route-warnings.ts` | `RouteWarning`, `RouteWarningSeverity`, `RouteWarningStatus` | Append-only warning log per route. Never delete — flip `status` to `'resolved'`. |
| `booking-windows.ts` | `BookingWindow`, `getBookingWindowsByRoute` | Structured weeks-before-departure guidance, additive to a route's `bookingWindowNote` prose. |
| `airport-notes.ts` | `AirportPracticalNote`, `getNotesByAirport` | Practical, hub-specific advice per airport (terminal assignments, rail links, etc.). |
| `traveller-tips.ts` | `TravellerTip`, `TravellerTipCategory` | Curated editorial tips scoped to a route/destination/airport. |
| `community-notes.ts` | `CommunityNote`, `getCommunityNotesForScope` | Real traveller-submitted notes. **Seeded empty on purpose** — no submission pipeline exists yet; see §9.4. |
| `guides.ts` | `Guide` | Long-form editorial guides, one per URL at `/guides/[slug]` for long-tail SEO. |

### 4.1 Time-bound direct services

A plain `isDirect: true/false` boolean can't honestly represent a route that's direct *today* with
a publicly announced end date (e.g. IndiGo's Manchester–Delhi/Mumbai services, both ending
1 September 2026). `Route` has two fields for this:

- `directServiceEndDate` (ISO date) + `directServiceEndNote` — set only when a currently-direct
  service has an announced withdrawal date. The route page renders a visible notice.
- `connectingAlternative` — the realistic fallback, whether the route is currently direct (framed
  as "what happens after") or already connecting-only (framed as "how this route works").

**When the withdrawal date passes:** flip `isDirect` to `false`, remove
`directServiceEndDate`/`directServiceEndNote`, rewrite `intro`/`frequency`/`airlineSlugs` for the
connecting-only reality using `connectingAlternative` as the basis, and move the withdrawal note
into `route-timeline.ts`. Never leave a route marked direct with a past end date.

### 4.2 Why `Deal` has no price field

`Deal` is curation metadata (which airport→destination+cabin combo deserves a card) with zero
price data. `DealCard` derives what to show entirely from `fare-observations.ts` via
`getFareRangeSummary(routeSlug, cabin)`:
- **Multiple observations** → an honest observed range (`£min–£max`).
- **One observation** → a single logged check.
- **No observations yet** → falls back to non-perishable route facts (flight time,
  direct/connecting, a link to booking-window guidance) via `NoFareFallback`/the card's fallback
  branch — never a placeholder price.

This removes the entire class of bug where a hardcoded price silently goes stale. **Never add a
price field back onto `Deal` and never hardcode a `£` figure in a component** — log a new
`FareObservation` instead.

### 4.3 Accumulation conventions (apply to every append-only file above)

1. **Append, never overwrite.** A fare change is a new `FareObservation` with a later
   `observedDate`. A resolved warning gets `status: 'resolved'`, never deletion.
2. **Only add an entry once it's a real, sourced fact.** Every seeded entry was migrated from
   prose already stated elsewhere in the codebase — none invented to fill a gap.
3. **Reference canonical tables instead of retyping strings.** `airlines.ts` and `peak-periods.ts`
   exist because free-text labels had already drifted (`'UK summer holidays (Jul–Aug)'` vs `'UK
   summer holidays'`). Add a new canonical entry first if one genuinely doesn't exist; never inline
   a new label.
4. **Empty is honest.** `community-notes.ts` ships empty because there's no submission pipeline —
   fabricating testimonials would violate the no-fabricated-content rule (§9). The corresponding
   component renders a plain "not yet" state. Follow this pattern for any future section without
   real content.

## 5. Routing (`/app`)

Static generation throughout — nothing in the public site reads a database or calls an external
API at request time (the four `/api/*` routes are the only server logic, and they're outbound
lead-capture, not data sources for pages).

- **Region hub pages** (`app/pakistan`, `app/india`, `app/gulf`, `app/umrah`, plus
  `app/family-holidays`, `app/business-class`) are thin pages passing region-specific copy/data
  into the shared `RegionHubPage` template (`components/sections/region-hub-page.tsx`).
- **Dynamic pages** — `app/destinations/[slug]`, `app/routes/[slug]`, `app/airports/[slug]`,
  `app/guides/[slug]` — use `generateStaticParams` against the matching `/data` array. Each also
  has an `opengraph-image.tsx` (Satori/edge runtime — see §9.2).
- **`/deals`** is the one page with client-side interactivity (`DealsExplorer`) for filtering the
  full fare list.
- **`/founder`** is the private command centre (§10) — not linked from any nav, `noindex`'d via
  `robots.ts` regardless.
- **`app/sitemap.ts`** — dynamic, includes real `lastModified` derived from the newest
  `FareObservation` per route (never a fabricated "changed today"; omits the field entirely when no
  real signal exists).
- **`app/robots.ts`** — disallows `/founder` explicitly.

## 6. Design system

All brand colour, type, and spacing tokens live in exactly two files:
`tailwind.config.js` and `app/globals.css`. **Never hardcode a hex value or a magic spacing number
elsewhere.** The only two sanctioned exceptions: WhatsApp's brand green in
`whatsapp-share-button.tsx`, and `app/**/opengraph-image.tsx` files (Satori's `ImageResponse` can't
read Tailwind config, so those files mirror the palette by hand). If the palette needs to change,
`tailwind.config.js` is the only file to touch.

### 6.1 Palette

| Token | Hex | Role |
|---|---|---|
| `ink` (900/DEFAULT `#0B0E14`) | near-black navy | Dark sections, body text |
| `brass` (500/DEFAULT `#C8932E`) | warm gold | Primary CTA colour, focus ring, accents |
| `terracotta` (500/DEFAULT `#C1502E`) | burnt orange | Secondary accent — eyebrows, category labels |
| `sand` (DEFAULT `#F7F2E9`) | warm off-white | Light section backgrounds |

Each has a full 50–900/950 scale in `tailwind.config.js`. Custom tokens beyond colour:
`shadow-brass-glow` (warm lift under brass CTAs on dark surfaces), `spacing[4.5]` (18px, used for
mid-size icons — without this token `h-4.5`/`w-4.5` silently render at default size), `maxWidth.content`
(1320px, the standard page container), `borderRadius` scale (`xs`→`xl`, 6px→28px).

### 6.2 Type

**Fraunces** (`font-display`, serif) for headings, **Public Sans** (`font-sans`, default body) —
both via `next/font/google`, wired in `app/layout.tsx`. Fraunces ships **no italic face** on
purpose (nothing sets `font-style: italic`; adding it back would double the display-font payload
for zero rendered glyphs — don't re-add without a real callsite).

### 6.3 Interaction language — one vocabulary site-wide

- **Solid conversion CTAs** (form submits, partner/affiliate links): hover to brass
  (`hover:bg-brass-400 hover:shadow-brass-glow` on brass buttons, `hover:bg-brass-600` on ink
  buttons), compress on press (`active:scale-[0.985]`).
- **Dark navigational buttons**: hover `bg-ink-700`.
- **Destination panels inside `group` cards**: zoom `group-hover:scale-[1.03]` over 500ms.
- **Every dark hero** opens with the same arrival moment: `relative overflow-hidden` on the
  section, the brass radial-gradient overlay (`<HeroBackdrop />`), and
  `stagger-in stagger-N animate-fade-up` on badge → h1 → intro (staggered via `.stagger-1..4` in
  `globals.css`, `prefers-reduced-motion` collapses all of it).
- **Focus**: no per-component `focus-visible:outline-none` — the global brass focus ring in
  `globals.css` (`:focus-visible { outline: 2px solid #C8932E; ... }`) is the one keyboard
  affordance for every interactive element.

Match these on any new surface rather than inventing a variant.

### 6.4 Image system — zero external requests, ever

One central resolver (`lib/brand-images.ts`) backs two render components:
- **`<DestinationVisual />`** — cards/panels. Renders real photography from
  `public/images/destinations/<slug>.*` when present, else the generated
  **`<DestinationMark />`** panel (a deterministic, seeded SVG arc/dot motif rendered entirely from
  design tokens — same city always produces the same graphic, so a wall of cards is stable across
  builds and never depends on a network request).
- **`<HeroBackdrop />`** — dark hero sections. Same fallback logic for
  `public/images/heroes/<key>.*`, with the photo always dimmed under a standard ink overlay + brass
  radial glow so headline contrast is guaranteed regardless of the photo.

`scripts/generate-image-manifest.mjs` scans `public/images/**` on every `predev`/`prebuild` and
writes `lib/image-manifest.json`; `brand-images.ts` resolves against that manifest (not live `fs`
calls) so lookups work identically in client components. **Adding or removing an image is a file
drop + deploy — never a code change.** Full art-direction brief, per-destination shot list, and the
master AI-generation prompt template live in `docs/visual-identity.md`. Alt text for delivered
photos is hand-written per slug in `DESTINATION_ALT`/`AIRPORT_ALT` (`lib/brand-images.ts`), checked
against the actual delivered image (a few deviate from the original brief) — never auto-generated.
Hero/guide backdrops are decorative (`alt=""`) because the heading beside them carries the meaning.

Current coverage (check `/founder` or `lib/image-manifest.json` for the live count): all 24
destinations have real photography; airport and hero coverage is partial — see
`docs/visual-identity.md`'s "Production order" for what to shoot next.

## 7. Affiliate & monetisation strategy

**Everything outbound funnels through one file: `lib/booking-providers.ts`.** No component
constructs a booking URL by hand.

- **Primary provider**: TravelUp, via a real Commission Junction (CJ) tracking link
  (`https://www.kqzyfj.com/click-101818709-15363607` — PID 101818709, AID 15363607). Every
  "Check live price(s)" / "Search live prices" CTA site-wide reads its URL from
  `getRouteBookingUrl()` / `getDealBookingUrl()` / `getGeneralBookingUrl()`.
- **Skyscanner**: present in `BOOKING_PROVIDERS` but `enabled: false` — their affiliate
  application was declined while the site is pre-launch. To re-enable: flip `enabled`, add the
  real tracking link, and repoint `PRIMARY_PROVIDER_ID`.
- **Deep-linking is deliberately off** (`supportsDeepLink: false`). A first attempt guessed a
  `/flights/search?origin=...` URL shape; in production it landed users on a TravelUp error page
  and lost their search (see git history — "Fix broken TravelUp deep links"). Every booking link
  today safely resolves to TravelUp's own default landing page, still real and commission-earning,
  just not destination-specific. To turn it on: manually visit `travelup.com`, confirm a real
  destination URL works, add it to `VERIFIED_DEEP_LINKS` keyed by destination slug, **only then**
  flip `supportsDeepLink` to `true`. Never add an entry from a guessed pattern.
- **Click attribution**: every link carries a `sid` (CJ's SubID field) built from
  page/route/cabin context via `buildSid()` — JetStash's own analytics, invisible to the visitor,
  never affecting where TravelUp sends them.
- **Link semantics**: every outbound affiliate `<a>` uses
  `rel="nofollow sponsored noopener noreferrer"` and opens in a new tab — matches Google's guidance
  for paid/affiliate links and is defined once per provider (`BookingProvider.rel`), never
  hand-typed at a call site.
- **To add a new provider**: add an entry to `BOOKING_PROVIDERS` with the same shape. Nothing else
  in the app needs to change.

**Lead-capture side** (not affiliate commission, but the second revenue channel):
`/quote-request` and `/contact` route to a real inbox (`siteConfig.contactEmail`, overridable via
`CONTACT_TO_EMAIL`) via Resend, for Umrah/family/group trips a human follows up on manually.

## 8. Forms & API routes

Four server routes, all under `app/api/`, all following the same pattern: **validate against the
shared option list the form itself renders from, then fail clearly with a 503 if the relevant
provider env vars aren't set — never silently pretend to succeed.**

| Route | Provider | Env vars | Validates against |
|---|---|---|---|
| `api/subscribe` | Brevo (`upsertBrevoContact`) | `BREVO_API_KEY`, `BREVO_LIST_ID` | `getAirportBySlug` (airports.ts), `isTravelInterest` (travel-club-options.ts) |
| `api/route-watch` | Brevo (same list, reused) | Same two vars | `getAirportBySlug`, `getDestinationBySlug`, `isRouteWatchIntent` (route-watch-options.ts) |
| `api/contact` | Resend (`sendResendEmail`) | `RESEND_API_KEY`, optional `CONTACT_TO_EMAIL` | Email format only |
| `api/quote-request` | Resend (same helpers) | Same two vars | `isQuoteTripType`, `isQuoteRegion` (quote-request-options.ts) |

Never re-declare a literal list of valid values inside an API route — the `lib/*-options.ts`
modules (or a `/data` lookup helper) are the one place a form and its API route both read from, so
they can't drift apart when an option is added.

Brevo specifics worth knowing: `upsertBrevoContact` treats a 400 with `code: 'duplicate_parameter'`
as success (existing contact re-added to the list is not a failure); any other 400 is real and
surfaces. Brevo **silently drops** any custom contact attribute that hasn't been created in its own
dashboard first — and does so *without erroring the request*, so the app keeps reporting success
while quietly losing data. This exact thing happened in production: env vars were confirmed live,
but all seven required attributes (`NEAREST_AIRPORT`, `TRAVEL_INTEREST`, `WATCH_AIRPORT`,
`WATCH_DESTINATION`, `WATCH_ROUTE`, `WATCH_REGION`, `WATCH_INTENT`) were missing from the connected
Brevo account, and real signups had already been saving with every preference field discarded.

The fix is `lib/brevo-attributes.json` (the canonical list, consumed both by `lib/brevo-attributes.ts`
as `BREVO_ATTRIBUTE_NAMES` for the two Brevo routes, and directly by
`scripts/setup-brevo-attributes.mjs`) — never hardcode an attribute name as a literal object key in
a route. Run `npm run brevo:setup` (idempotent — safe to re-run, only creates what's missing) any
time a new attribute is added to the JSON list, or when connecting a fresh Brevo account. It's a
deliberately manual, explicit step — not a `predev`/`prebuild` hook — because it mutates a real
third-party account and needs the real `BREVO_API_KEY` in the shell running it; it should never run
silently as a side effect of `npm install` or `npm run dev`. Whether the attributes *currently
exist* still can't be verified from code at request time (no read-only check is wired into
`/founder`) — only that the code *would* create them correctly if run.

## 9. Content integrity — the rules this codebase enforces as a bug class

This is the single most load-bearing set of conventions in the repo. Violating any of these is
treated the same as a functional bug, not a style nit.

### 9.1 No fabricated content
Every statistic, price, and claim must trace to an editable data file, or be explicitly marked as
a placeholder. No invented urgency ("only 3 seats left"), no invented social proof
("50,000+ travellers"), nothing that can't be traced to real, editable data.

### 9.2 No fabricated structured data
`components/seo/json-ld.tsx` only emits facts that exist elsewhere on the page. Deliberately
**no** `Product`/`Offer` schema anywhere (that would require a specific price the site never
claims — a stale structured-data price is a real Google Merchant penalty risk). Deals get an
honest `ItemList` schema instead: real names and URLs, no price claim either way. The
`Organization` schema omits `email` entirely rather than pointing at a non-working address.

### 9.3 Verified route and airport claims
Every route in `data/routes.ts` was checked against real airline schedule data before being
written — not assumed from a brief or a press release. Two standing examples of what "verify"
means in practice:
- **Leeds Bradford → Islamabad** is modelled as *connecting*, not direct — conflicting sources
  (a 2025 PIA announcement, a collapsed start-up airline under CAA investigation) mean there's no
  stable current direct service, and the instability is stated honestly in the route's own copy
  and in `route-warnings.ts` rather than asserted as settled fact.
- **Manchester → Jeddah** and **Birmingham → Madinah** are connecting, requiring a change at Doha,
  Istanbul, or Jeddah — written accordingly, not as direct routes.

Apply the same standard to any new `data/routes.ts`/`data/airports.ts` entry: a named UK city pair
in a press release is not the same as a stable, bookable, ongoing service.

### 9.4 Empty is honest
`data/community-notes.ts` ships empty because there's no submission pipeline. The corresponding
component renders a plain "not yet" state. Never fabricate placeholder testimonials to fill a
visually empty section — follow the same pattern for any future feature with no real content yet.

### 9.5 Travel Club tells the truth about its own mechanism
`/travel-club` and the newsletter signup promise **manual, human-curated** fare/route alerts
segmented by `TRAVEL_INTEREST`/`NEAREST_AIRPORT` — never automated live price tracking, which
doesn't exist. `app/api/subscribe/route.ts`'s docstring states this explicitly. If the site owner
doesn't intend to actually send these emails on an ongoing basis, the fix is to soften the page
copy further, not to silently let the promise go unfulfilled. See
`docs/travel-club-email-sequence.md` for the actual manual send templates and the "no fixed
schedule, segment every send" discipline.

## 10. The Founder Command Centre (`/founder`)

A private, unlinked, `noindex`'d dashboard (`app/founder/page.tsx` + `lib/founder-insights.ts`)
that derives every figure it shows from the same `/data` files and environment variables the
public site uses — nothing estimated or invented. Where a fact genuinely can't be known from code
(Brevo subscriber counts, inbox contents, whether Brevo's custom attributes actually exist), it
says so honestly instead of showing a fabricated number.

It's organised by **business priority**, not technical severity:
- `blocker` — broken or dishonest *right now* (a visitor hits an error, or the site claims
  something untrue). Fix before treating the site as launch-ready.
- `revenue` — works today but leaves money on the table (unpaid clicks, unresearched fares,
  unrouted leads).
- `nice-to-have` — polish with no deadline and no functional/revenue impact.

Sections: quote-request/Travel Club connectivity, broken/placeholder deal links, time-bound
service changes (the one category with a real forcing date), affiliate/booking-provider status,
fare-observation coverage, missing photography, route warnings due for re-verification, stale
dated content, and a launch checklist mirroring the README's "Required before launch" section.
When adding a new operational concern worth tracking, add a section here rather than a one-off
TODO comment — it keeps "what needs attention" centrally derivable instead of scattered.

## 11. Deployment

Vercel, zero-config (Next.js auto-detected).

1. Push to a GitHub repository (already the case — remote `origin`, branch `main`).
2. In Vercel: **Add New Project** → import the repo.
3. Set environment variables in **Project Settings → Environment Variables** before any deploy
   that needs them:

| Variable | Used by | Required for |
|---|---|---|
| `BREVO_API_KEY` | `api/subscribe`, `api/route-watch` | Newsletter/Route Watch signups to save |
| `BREVO_LIST_ID` | `api/subscribe`, `api/route-watch` | Same |
| `RESEND_API_KEY` | `api/contact`, `api/quote-request` | Contact/quote forms to actually send |
| `CONTACT_TO_EMAIL` | `api/contact`, `api/quote-request` | Optional — overrides `siteConfig.contactEmail` |

4. Connect the domain (`jetstash.co.uk`) under **Project Settings → Domains**.
5. Before treating any deploy as launch-ready, also confirm the Brevo custom contact attributes
   exist (`NEAREST_AIRPORT`, `TRAVEL_INTEREST`, `WATCH_AIRPORT`, `WATCH_DESTINATION`,
   `WATCH_ROUTE`, `WATCH_REGION`, `WATCH_INTENT`) — Brevo silently drops attributes it doesn't
   recognise, and this can't be checked from code.

No remote image hosts are configured (`next.config.js`) — all imagery is either local files under
`public/images/` or the locally rendered `<DestinationMark />` fallback, so there's nothing to add
to `remotePatterns` unless a genuinely external image host is introduced later.

`next.config.js` sets `eslint: { ignoreDuringBuilds: true }` — `next build` will not catch lint
issues. Run `npm run lint` as a separate step (CI or manually) if lint cleanliness matters for the
change.

## 12. Deliberate scope decisions — what's not built, and why

Recorded so these aren't re-litigated by accident:

- **Continuous live fare tracking (e.g. 10-minute polling) — evaluated and rejected (July 2026).**
  Re-examined from first principles against the mid-2026 API market: the customer value ("when
  should I book", "is this fare typical") is *pattern* intelligence that changes on a scale of days
  to weeks, so sub-daily polling was an imported metasearch assumption, never a requirement.
  Relevant market facts at time of decision: Amadeus Self-Service was decommissioned 17 July 2026;
  Kiwi Tequila is closed to new small partners; Travelpayouts/Aviasales' cached Data API is free
  for affiliates but its data must not be displayed as JetStash-observed fares (grey-zone with CJ
  monetization — internal-signal use only, pending written confirmation); Duffel is booking
  infrastructure, wrong fit for display-only pricing. The standing model instead: dated,
  human-verified fare observations (§4.2), optionally automation-*assisted* (a free cached-data
  signal prompting a human to verify and log) once traffic justifies it, and genuine live
  verification only behind a real revenue gate (~£500+/mo affiliate revenue). Displayed prices are
  always "checked on <date>", never "live".
- **Hotels, Car Hire, Airport Lounges, Airport Parking** — deliberately deferred. Each needs either
  a live inventory/booking integration or genuine local-market knowledge this codebase doesn't have
  yet. Shipping placeholder content for these now would repeat the classic early-stage travel-site
  mistake: going wide and shallow instead of finishing the core route network first. Revisit once
  the core routes are live, indexed, and converting.
- **eSIMs, Travel Insurance** — worth adding once there's traffic to serve them to (low-build-cost
  affiliate resource pages), but don't build ahead of demand.
- **Bangladesh** — a named target market with zero current content. Needs the same real-schedule
  verification as §9.3 before anything goes into `data/routes.ts`; don't infer routes from demand
  alone.
- **A real community-notes submission pipeline** — currently schema-only and empty (§9.4). Needs a
  submission form and a moderation step; a genuine scope increase given there's no database today.
- **Promoting Turkey, Morocco, Saudi Arabia to first-class `RegionGroup`s** — they currently sit
  inside `mediterranean`/`north-africa`/`gulf`. Do this once there's enough route depth in each to
  justify a dedicated hub, not ahead of the content that would fill it.

## 13. How to extend this codebase without breaking its rules

A quick-reference checklist for common changes:

- **Adding a route** → verify against real airline schedules first (§9.3), add to `routes.ts`
  referencing existing (or newly-added) `airlines.ts`/`peak-periods.ts` entries, never inline a new
  label. Add a matching `Deal` in `deals.ts` if it should surface as a card (no price field). Log a
  `FareObservation` once you've actually checked a fare — optional, no deadline.
- **A fare changes** → append a new `FareObservation` with a later `observedDate`. Never edit the
  old one.
- **A route's direct service gets a withdrawal announcement** → set
  `directServiceEndDate`/`directServiceEndNote`, populate `connectingAlternative` if not already
  present. When the date passes, follow §4.1's procedure exactly.
- **A new page/section needs a hero image** → add a `heroKey`, drop
  `public/images/heroes/<key>.*` per `docs/visual-identity.md`'s naming convention — no code
  change needed for the fallback to upgrade.
- **A new UI surface needs a button/hover state** → reuse `<Button>`/`<LinkButton>` variants
  (§6.3) rather than inventing a new hover treatment.
- **A new outbound link to a booking partner** → go through `lib/booking-providers.ts`'s existing
  helpers. Never hand-construct a partner URL in a component.
- **A new form/API route** → follow the fail-clearly-with-503 pattern (§8); put its option list in
  a shared `lib/*-options.ts` module the form and the route both import.
- **Any new claim about a real-world fact** (price, schedule, statistic) → it must be traceable to
  a `/data` entry or explicitly marked as a placeholder. When in doubt, don't ship the claim yet.

## 14. Product direction — "check JetStash first" (decision record, July 2026)

A standing strategic decision, recorded so future work builds toward it rather than around it:
**JetStash is a decision-intelligence product, not an affiliate content site.** The goal of every
major feature is to give travellers a genuine reason to visit JetStash *before* any booking site —
the affiliate click is the consequence of that trust, not the product itself.

- **The approved hero feature is Book-By Countdown** (working name; public framing "the JetStash
  Booking Window"): festival-anchored booking guidance — "flying for Eid al-Adha? book by
  mid-February" — derived entirely from data JetStash already holds or verifies editorially
  (peak periods, booking windows, dated fare observations, a verified festival-dates table).
  Pattern guidance with a visible basis, never price prediction. V1 scope: five priority
  routes only, state-dependent CTAs (window open → "check live price"; too early → Route Watch
  capture; surge zone → honest urgency), WhatsApp-shareable advice cards. Phased V2/V3 gates in
  §12's live-tracking decision. **V1 shipped July 2026 — architecture in §14.1.**
- **Advice that defers a booking defers a commission — accept that trade.** When the honest
  recommendation is "not yet", the Route Watch signup is the commercial bridge (deferred intent →
  owned re-engagement channel). Never bias advice toward the immediate click; the trust *is* the
  moat. This makes Book-By Countdown and Travel Club one system — the Route Watch pipeline
  (including its Brevo attributes, §8) is on the hero feature's critical path. Both now compose
  through the Travel Intelligence Engine (§14.2) rather than existing as two adjacent features.
- **Travel Confidence Score does not ship as a standalone number.** A composite score is
  editorial weighting dressed as measurement — too close to the fabricated precision §9 exists to
  prevent. Its ingredients (route warnings, service stability, direct/connecting honesty) instead
  surface as an explainable confidence strip inside the Book-By panel, with visible criteria.
- **The data moat compounds independently of any UI: start collecting now.** (a) A verified
  festival-dates table (real Gregorian dates per year, same verification standard as route
  claims — `peak-periods.ts` deliberately only says "shifts yearly" today). (b) Fare observations
  should record the *departure date the fare was for* (proposed additive optional field on
  `FareObservation`) — without days-to-departure, the days-out price curves that make V3 possible
  can never be computed from the log. (c) CJ sid-level click data to learn which routes convert.
  Observation history cannot be backfilled; every logged week widens the un-copyable part.

### 14.1 V1 architecture (shipped July 2026)

**One derivation layer, everything else reads from it.** `lib/booking-intelligence.ts` is the only
place that computes a booking state, a book-by date, or event countdown maths — the route panel,
destination strip, homepage ribbon, route-map layer, WhatsApp share text, and the Founder cadence
section all call `computeBookBySnapshot()` / `computeBookBySnapshotsForDestination()` /
`computeAllBookBySnapshots()` rather than deriving dates themselves. `BOOK_BY_PRIORITY_ROUTE_SLUGS`
in that file is the single list gating which five routes any Book-By surface renders for
(`manchester-lahore`, `manchester-islamabad`, `london-heathrow-delhi`, `london-heathrow-jeddah`,
`birmingham-amritsar`) — add a route to V1 by editing that one array, not by hunting through pages.

**New data files:**
- `data/peak-period-dates.ts` — verified Gregorian dates per year for each `peak-periods.ts` id
  (2026–2028). Every entry carries a `precision` (`'confirmed'` | `'estimated-lunar'` |
  `'approximate-seasonal'`) and a `dateNote` explaining the uncertainty — Islamic dates are
  astronomical estimates pending real moon-sighting confirmation, and every surface that renders
  them keeps that visible (`formatEventDate()` prefixes "expected"/"around" accordingly). Follows
  the same verify-before-adding standard as route claims (§9.3); a `sourceNote` on every entry
  records where it was checked. Add next year's dates before the current ones run out.
- `data/fare-observations.ts` gained an optional `departureDate` field on `FareObservation` — the
  departure the fare was quoted for, needed to compute days-to-departure for future price curves
  (Phase 2/3). Backward-compatible; never backfilled onto historic entries.
- `data/booking-windows.ts` gained `role` (`'recommended'` | `'avoid'` | `'typical'`) and
  `appliesToPeriodIds` — so the engine only applies a route's stated "book 12+ weeks out" advice to
  the peak period it's actually about (Eid), never silently reused for an unrelated period like UK
  summer holidays.

**Rendering split — build-time snapshot + client recompute.** Route pages compute a
`BookBySnapshot` server-side at build time (`computeBookBySnapshot(routeSlug, new Date())`) so the
static HTML carries full advice for SEO and no-JS visitors. `components/route/book-by-countdown.tsx`
is a client component that recomputes the same snapshot against the visitor's real clock after
mount — this is what activates the "today" marker and live day-counts without ever risking a stale
build-time snapshot being shown as current. Every date the *server* render shows is absolute
("book by 14 February 2027"), never a day-count, so a page built weeks ago is still correct.

**Where it renders:**
- `components/route/book-by-countdown.tsx` — the full panel, route pages only, priority routes only.
- `components/sections/booking-moment-strip.tsx` — destination pages, one line per priority route
  serving that destination, server-rendered only (no client JS, no day-counts).
- `components/sections/next-travel-moment-ribbon.tsx` — homepage, the soonest event across all
  priority routes plus how many currently have an open window.
- `components/sections/route-map-hero.tsx` — gained an optional `bookBySnapshots` prop; a
  destination marker gets one quiet pulsing brass ring (the existing `animate-pulse-dot` motif,
  already used by `<DestinationMark />`) when its Manchester route has an open window. Only
  `manchester-lahore`/`manchester-islamabad` can ever trigger it — the map only shows Manchester
  departures — so the indicator stays rare by construction, not by a manual toggle. No other visual
  change to the map.

**CTA click attribution.** `getRouteBookingUrl()` in `lib/booking-providers.ts` gained an optional
`sidContext` parameter — the Book-By panel passes `bookby-${state}` so CJ sid data can show which
booking state actually drove a click, without touching the URL a visitor lands on.

**Founder cadence tracking.** `lib/founder-insights.ts`'s `bookByCadenceStatus()` section (priority
`nice-to-have`, status never escalates past `'watch'`) flags priority routes whose latest
observation is older than `OBSERVATION_FRESH_DAYS` (60) or lacks a `departureDate` — support for the
weekly logging workflow below, not a launch gate, because the panel already degrades honestly
(calendar-only guidance, no price context) when data is thin.

**The weekly logging workflow this feature depends on:** for each of the five priority routes,
check a fare on TravelUp or the airline's own site, then append a new `data/fare-observations.ts`
entry with `departureDate` set to the date you'd actually book for (typically the route's next
upcoming peak-period occurrence from `peak-period-dates.ts`). Never overwrite an existing entry.
No enforced deadline — `/founder`'s cadence section is the reminder, not a blocker.

### 14.2 The Travel Intelligence Engine (standing architecture, July 2026)

**Book-By Countdown, Route Watch, Travel Confidence, Travel Ready Check, and every future
intelligence module are inputs into one engine, not separate products.** The customer-facing
question is always the same one: *"Am I ready to book?"* — never "here are four unrelated tools."
`lib/travel-intelligence-engine.ts` is the single composition layer; nothing outside it resolves
multiple signals into a customer-facing verdict.

**"One recommendation" means one verdict, never one blended score.** A weighted composite hiding
a route warning behind a reassuring number would be exactly the fabricated-precision mistake §9
exists to prevent — it's why Travel Confidence Score was already rejected as a standalone metric
(§14). The engine instead resolves signals via a **priority decision tree** — the most serious true
fact wins, nothing is averaged — mirroring the `worst()` pattern already proven in
`lib/founder-insights.ts` for the Founder dashboard, now pointed outward at customers for the first
time. Every verdict stays fully attributed: the underlying facts (a booking-window state, an active
warning, eventually a document-readiness check) remain individually visible, never hidden inside
the top-line answer.

**Subscription is to Route Watch, singular — not to individual alert types.** A visitor subscribes
once per route; the engine decides what's genuinely worth telling them, across every module that
composes into it. Users never choose "price alerts vs. disruption alerts vs. visa alerts" as
separate opt-ins — that would recreate the "four separate tools" problem in the subscription model
even after fixing it on the page.

**Future modules plug in via a reserved slot on the engine's snapshot, never a rewrite.** Travel
Ready Check (§14.3, shipped July 2026) was the first module to fill this slot: `computeReadiness()`
gained an optional 3rd `travelReadySignal` parameter, defaulting to `null` for every existing call
site, with zero changes to `EngineSnapshot`, `TravelReadySignal`, or `VERDICT_COPY`. This is what
"future intelligence modules" means concretely — the composition point already existed before the
module that filled it did, and the next one plugs in the same way.

**Detection is automatable now; sending stays human.** The long-term objective is that the engine
detects, decides, drafts, segments, and eventually sends most of this with minimal human
intervention — but every send today goes through founder review (the same trust model that governs
every other honesty-critical claim on this site). The one documented exception worth revisiting
later: a pure booking-window-opened transition is date arithmetic with zero editorial judgment in
it, making it the single best future candidate for automated send once the system has earned that
trust.

**No new Brevo attributes without a provisioning path.** Multi-route watching is real in this
architecture, but it's built by repurposing the already-provisioned `WATCH_ROUTE` attribute to hold
a small delimited list, not by adding a new attribute — adding one without a working way to create
it in Brevo would silently reproduce the exact drift bug already fixed once this year (§8).

### 14.3 Travel Ready Check — document/entry readiness (shipped July 2026)

**The connected but different question.** Book-By Countdown answers "when should I book?" Travel
Ready Check answers "can I actually travel on these dates with the documents I have?" Same engine,
same "am I ready to book?" customer-facing question, one more input — never a fourth, disconnected
tool. It never gives a legal guarantee, never claims definite eligibility, never presents visa or
passport guidance without an official source attached, and never hides that a rule has aged past
the point it's confident relying on.

**One central rules layer, nothing scattered.** `data/travel-ready-rules.ts` is the only place a
visa or passport fact lives — no destination page, component, or API route hand-writes one. Every
`TravelReadyRule` carries `country` (matching `Destination.country`), `nationalityScope`,
`ruleType`, a plain-English `requirement`, an official `officialSource` (title + URL — GOV.UK
foreign travel advice or the destination's own visa portal, never a blog, forum, or travel agency
page), `lastVerifiedDate`, and `reviewDueDate` (6 months out). `lib/visa-links.ts`'s per-country
"here's an official link" pointer is unchanged and still used elsewhere; this is the separate,
machine-readable table the decision tree actually evaluates.

**Stale rules degrade automatically, never silently.** `isRuleStale(rule, nowIso)` returns true once
`reviewDueDate` passes. `lib/travel-ready-check.ts`'s decision tree treats a stale rule the same as
"we can't confirm this" — the affected check renders "official confirmation required" instead of
continuing to present a months-old fact as current. This is the same content-integrity discipline
§9 already applies to route and festival-date claims, now applied to a compliance-adjacent feature
where staleness is a higher-stakes failure mode.

**One verdict from an ordered decision tree, never a blended score.** `evaluateTravelReadiness()` in
`lib/travel-ready-check.ts` evaluates every applicable check (passport validity, then visa/entry
permission) and returns one of six verdicts — `ready-to-continue`, `check-passport-validity`,
`visa-or-entry-permission-needed`, `document-timing-may-affect-booking`,
`official-confirmation-required`, or `not-enough-information` — via the same "worst true fact wins"
priority already used by the engine and by `lib/founder-insights.ts`'s `worst()`. Every check
evaluated stays individually visible in the result's `checks` array regardless of which one decided
the top-line verdict.

**V1 coverage is 7 countries, British passport holders first.** Pakistan, India, Saudi Arabia, UAE,
Qatar, Turkey, Morocco — chosen because they're already the exact 7 countries `lib/visa-links.ts`
covers, and because all 5 `BOOK_BY_PRIORITY_ROUTE_SLUGS` routes happen to serve them. NICOP/POC
(Pakistan) and OCI (India) document holders get their own exemption rules, sourced the same way.
Every other nationality, and every destination outside these 7 countries, returns
`not-enough-information` — an honest "not yet covered", never a guess. Where an official source
doesn't publish a firm visa-processing-time figure (Pakistan, Saudi Arabia), the rule leaves
`typicalProcessingDays` unset rather than inventing one; the decision tree falls back to a plainly
labelled *JetStash general guidance* buffer (`GENERIC_DOCUMENT_SAFETY_DAYS`, 6 weeks) rather than
presenting an unsourced number as an official rule.

**Engine integration is additive, not a rewrite.** `computeReadiness(routeSlug, now,
travelReadySignal?)` gained an optional 3rd parameter (default `null`, preserving every existing
call site's behaviour). `components/route/route-readiness-panel.tsx` is the only place that supplies
a real one — it lifts the Travel Ready Check result client-side, entirely in the visitor's browser,
and re-derives the Book-By panel's badge with it folded into the same priority tree (`critical` →
`wait-critical`, `caution` → `ready-with-caution`, alongside route warnings). On the 5 Book-By
priority routes this produces one merged panel; on every other route serving a supported country,
Travel Ready Check renders as its own standalone card (no engine badge exists there to merge with);
everywhere else, nothing new renders at all.

**Privacy boundary.** No API route and no server persistence exist for the check itself — it's a
pure function of form inputs, computed and thrown away in the browser, mirroring the site's
no-database architecture (CLAUDE.md). Passport numbers, dates of birth, and other document numbers
are never asked for or collected. The only data that ever reaches Brevo is what Route Watch already
collected before this feature existed (email, route, destination, intent) — nothing typed into the
Travel Ready form itself is ever sent anywhere.

**Route Watch integration reuses the existing pipeline, no new attribute.** `RouteWatchIntent`
(`lib/route-watch-options.ts`) gained one new value, `'document-timing'` — the same
`WATCH_INTENT` Brevo attribute already provisioned, never a new one (§8's drift lesson, reapplied).

**Founder ops section.** `lib/founder-insights.ts`'s `travelReadyOpsStatus()` flags rules within 30
days of `reviewDueDate` (`watch`) and rules already past it (`attention` — the public UI has already
degraded safely, but it's real backlog worth clearing). Priority is `revenue`, not `nice-to-have` —
unlike fare-observation cadence, an unrefreshed visa/passport rule is a trust and compliance concern,
not pure commercial polish.

**What's deliberately not built.** No document upload, no OCR, no passport scanning, no live
immigration API integration, no numeric "Travel Confidence Score" (rejected once already in §14 for
the same fabricated-precision reason), and no attempt at every nationality or every destination.
Automate detection, verdict generation, staleness suppression, and engine composition; keep rule
content changes — a genuine change in official guidance — as a human, sourced edit to
`data/travel-ready-rules.ts`, the same standing rule §13 already applies to every other data file.
