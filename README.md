# JetStash 2.0

A Next.js 14 (App Router) rebuild of JetStash — the UK's travel hub for Pakistan, India, the Gulf, Umrah travel, family holidays and business class, alongside Mediterranean and North African routes.

## Project status and roadmap

Start with [`docs/project-control/`](docs/project-control/README.md) for the current production
baseline, completed-work ledger, active roadmap and decision log. It supersedes stale task-status
claims in older phase reports; `JETSTASH_PRINCIPLES.md` remains the authority for standing product
and architecture rules.

## Stack

- **Next.js 14** (App Router, static generation for destination/airport pages)
- **TypeScript**
- **Tailwind CSS** with a custom brand token system (`tailwind.config.js`)
- **Fraunces** (display serif) + **Public Sans** (body) via `next/font/google`
- No database — content lives in typed data files under `/data`

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, "Add New Project" → import the repo. Vercel detects Next.js automatically — no config needed.
3. Add environment variables (see below) in **Project Settings → Environment Variables** before your first production deploy that needs them.
4. Connect your domain (`jetstash.co.uk`) under **Project Settings → Domains**.

## Required before launch — read this

This codebase was written without the ability to run `npm install` or a real build in the environment it was produced in (no network access to the npm registry). Before treating this as launch-ready:

1. **Run a real build and fix whatever the compiler finds.** `npm install && npm run build` locally or let Vercel's first deploy do it. Note for Windows: run the build from the *correctly-cased* project path (`C:\Users\<you>\Documents\...`, capital D). Building from a lowercase-`documents` working directory makes webpack resolve two differently-cased copies of every module, which loads React twice and fails prerendering with `Cannot read properties of null (reading 'useContext')`.
2. **Replace generated destination panels with real photography.** All destination imagery is currently rendered locally by `components/ui/destination-mark.tsx` — an on-brand generated panel (zero external requests, never a broken image). This is deliberate and ships fine, but real photography will always convert better; the complete shot list, art direction and naming convention live in `docs/visual-identity.md` — drop correctly named files into `/public/images/` and the brand-image system picks them up on the next build, no code changes.
3. ~~Wire up the newsletter.~~ **Done.** `/app/api/subscribe/route.ts` is wired to Brevo (free up to 300 emails/day); `BREVO_API_KEY` and `BREVO_LIST_ID` are set in Vercel Production. The form captures a nearest-airport and travel-interest preference via the `NEAREST_AIRPORT`/`TRAVEL_INTEREST` custom contact attributes — all seven required attributes (these two plus the five `WATCH_*` below) were confirmed created in Brevo and live-tested end to end (a real signup, attributes verified stored correctly via the Brevo API) in July 2026. If you ever connect a fresh Brevo account, run `npm run brevo:setup` (canonical list in `lib/brevo-attributes.json`) to recreate them — Brevo silently drops any attribute it doesn't recognise rather than erroring, so this is worth re-confirming after any account change.
4. **Wire up the contact form.** `/app/api/contact/route.ts` is written for Resend (resend.com) but needs `RESEND_API_KEY` set. Same fail-clearly behaviour until configured. `CONTACT_TO_EMAIL` is optional — both this route and `/app/api/quote-request/route.ts` fall back to `siteConfig.contactEmail` (`lib/site-config.ts`) when it's unset.
5. **Log genuinely researched fare checks.** `/data/deals.ts` no longer carries a price at all — deal cards derive an honest range/single-check from `/data/fare-observations.ts` (`getFareRangeSummary`), or fall back to route facts when nothing's logged yet. That removes the staleness risk, but the £ figures currently in `/data/fare-observations.ts` are still the original example numbers, not independently verified fares. There's no deadline to do this (see `/founder`'s "Fare observation coverage" section) — append real researched checks over time as a new `FareObservation` entry per route/cabin, never overwriting an existing one.
6. ~~Sign up for TravelUp's real affiliate programme and add the tracking parameters.~~ **Done.** Every outbound booking link ("Check live price[s]", "Search live prices") is generated centrally by `lib/booking-providers.ts` and now uses TravelUp's real Commission Junction tracking link (`https://www.kqzyfj.com/click-101818709-15363607` — PID 101818709, AID 15363607), tagged with a per-route/page `sid` for click attribution. Every click-through now earns commission. To re-enable Skyscanner in future, flip its `enabled` flag and add its real tracking link in the same file — nothing else in the app needs to change.
7. **Manually verify a real TravelUp destination URL and turn deep-linking on.** A first attempt guessed a `/flights/search?origin=...` URL shape for route-specific links; in production this landed users on a TravelUp error page and lost their search. `BOOKING_PROVIDERS.travelup.supportsDeepLink` is deliberately still `false`, so every booking link safely resolves to TravelUp's own default landing page via the tracking link above (still commission-earning, just not destination-specific) rather than a broken deep link. To turn it on: visit `travelup.com` in a real browser, confirm a real destination URL works (e.g. their `/en-gb/flight-offers/{city}-{iata}` pages, if that pattern holds), add it to `VERIFIED_DEEP_LINKS` in `lib/booking-providers.ts`, then flip `supportsDeepLink` to `true`. Never add an entry from a guessed pattern.
8. ~~Create the Route Watch Brevo attributes.~~ **Done** (see item 3 — confirmed together with the newsletter attributes). `/app/api/route-watch/route.ts` reuses `BREVO_API_KEY`/`BREVO_LIST_ID` and writes `WATCH_AIRPORT`, `WATCH_DESTINATION`, `WATCH_ROUTE`, `WATCH_REGION`, `WATCH_INTENT`. Note `WATCH_ROUTE` holds a comma-delimited list of up to 3 route slugs, not a single value — the shared cap is defined in `lib/route-watch-config.ts` (`MAX_WATCHED_ROUTES`) — deliberately reusing the existing attribute rather than adding a new one that would need re-provisioning. This is a storage mechanism only; it does not imply Travel Intelligence Engine integration.
9. ~~Route quote-request leads somewhere real.~~ **Done.** `/app/api/quote-request/route.ts` and `/app/api/contact/route.ts` both reuse `RESEND_API_KEY`/`CONTACT_TO_EMAIL` (no new env vars) and now default to `siteConfig.contactEmail` in `lib/site-config.ts` — a real inbox, not a placeholder — when `CONTACT_TO_EMAIL` isn't set in Vercel. Every Umrah/family/group quote request lands in one inbox for manual follow-up; revisit whether that should become a rotation of partner agents or a shared inbox as volume grows.
10. **Keep Travel Ready Check's rule content current.** `data/travel-ready-rules.ts`'s 15 rules across 7 countries were verified against live GOV.UK/official-portal pages in July 2026 with a 6-month review window — this is content, not code, and visa/passport rules change with little notice (Pakistan suspended visa-on-arrival for most nationalities on 1 January 2026 with no advance notice). See "Travel Ready Check — maintaining `data/travel-ready-rules.ts`" above for the re-verification procedure, and `/founder`'s "Travel Ready Check — rules ops" section for what's currently due.

## Environment variables

| Variable | Used by | Required for |
|---|---|---|
| `BREVO_API_KEY` | `/app/api/subscribe/route.ts` | Newsletter signups to actually save |
| `BREVO_LIST_ID` | `/app/api/subscribe/route.ts` | Newsletter signups to actually save |
| `RESEND_API_KEY` | `/app/api/contact/route.ts`, `/app/api/cron/fare-check-reminder/route.ts` | Contact form to actually send; weekly fare-check reminder email |
| `CONTACT_TO_EMAIL` | `/app/api/contact/route.ts`, `/app/api/quote-request/route.ts`, `/app/api/cron/fare-check-reminder/route.ts` | Optional — overrides `siteConfig.contactEmail` as the delivery address for contact/quote-request messages and the fare-check reminder |
| `CRON_SECRET` | `/app/api/cron/fare-check-reminder/route.ts` | Optional but recommended — Vercel sets this automatically for its own Cron Jobs (see `vercel.json`); the route checks it if present, so anyone else hitting the URL directly gets a 401 |

## Project structure

```
app/                  Routes (Next.js App Router)
  page.tsx            Homepage
  pakistan/ india/ gulf/ umrah/     Region hub pages
  family-holidays/ business-class/ travel-club/
  deals/              All fares, with client-side filtering
  quote-request/      Umrah/family/group trip quote-request form
  destinations/[slug] Dynamic destination pages (generateStaticParams)
  airports/[slug]     Dynamic airport pages (generateStaticParams)
  api/subscribe/      Newsletter API route
  api/contact/        Contact form API route
  api/quote-request/  Umrah/family/group quote-request API route (Resend)
  api/route-watch/     Per-route Route Watch signup API route (Brevo)
  sitemap.ts          Dynamic sitemap.xml
  robots.ts           robots.txt

components/
  ui/                 Button, Badge, DealCard, HubCard — shared primitives
  layout/             Header, Footer
  sections/           RouteMapHero, NewsletterSection, QuoteRequestForm, RegionHubPage template,
                       BookingMomentStrip, NextTravelMomentRibbon (Book-By Countdown — see below)
  route/               warning-banner, route-timeline, fare-history-panel, booking-window-panel,
                       traveller-tip-list, community-notes-panel, route-watch-form, whatsapp-share-button,
                       book-by-countdown (the "when to book" panel — priority routes only)

data/
  airports.ts             UK departure airports
  destinations.ts         All destinations across every region
  routes.ts               Airport-to-destination route guides
  deals.ts                Every current example fare shown across the site
  airlines.ts              Canonical airline reference (data/routes.ts links by slug)
  peak-periods.ts          Canonical demand-period reference (routes/destinations link by id)
  peak-period-dates.ts     Verified Gregorian dates per year for each peak period (Book-By Countdown)
  route-timeline.ts        Real, dated history of changes to specific routes
  route-warnings.ts        Append-only warning log per route
  fare-observations.ts     Append-only fare history per route (optional departureDate per entry)
  booking-windows.ts       Structured booking-window guidance, additive to route prose
  airport-notes.ts         Practical, hub-specific advice per airport
  traveller-tips.ts        Curated tips scoped to a route/destination/airport
  community-notes.ts       Real traveller-submitted notes (seeded empty — no submission pipeline yet)

lib/
  site-config.ts             Nav structure, region groupings, site metadata
  brand-images.ts             Real-photography resolver, backed by lib/image-manifest.json
  booking-intelligence.ts     Book-By Countdown's single derivation layer — see JETSTASH_PRINCIPLES.md §14
  travel-intelligence-engine.ts  Composes Book-By + route warnings into one readiness verdict — §14.2
  utils.ts                   Tailwind className merge helper
  quote-request-options.ts   Shared trip-type/region options for the quote-request form + API route
```

## Book-By Countdown & the Travel Intelligence Engine

Route pages (five priority routes only — see `BOOK_BY_PRIORITY_ROUTE_SLUGS` in
`lib/booking-intelligence.ts`) show a "When to book" panel: the next relevant festival/peak period,
a book-by date derived from that route's own stated booking-window guidance (or, where none exists,
the universal "fares rise sharply in the final 3–4 weeks" rule already stated in
`data/peak-periods.ts`), a visual timeline, the latest logged fare for context, and a
state-dependent CTA (book now / Route Watch / honest urgency). Never a live-price claim —
see JETSTASH_PRINCIPLES.md §14 for the full product decision and §14.1 for the architecture.

The panel also carries a small readiness-verdict badge ("Ready to book" / "Not yet" / "Check before
booking"...) — this is the customer-facing surface of `lib/travel-intelligence-engine.ts`, which
composes the booking-window state with any active route warning into one attributed answer to "Am I
ready to book?" (JETSTASH_PRINCIPLES.md §14.2). It's a priority decision tree, never a blended
score — every fact behind the badge stays individually visible.

**The weekly workflow this depends on:** for each priority route, check a fare on TravelUp or the
airline's own site, then append a new `data/fare-observations.ts` entry with `departureDate` set to
the date you'd actually book for. `/founder`'s "Book-By Countdown data cadence" and "Travel
Intelligence Engine — alert queue" sections (both nice-to-have, never a launch blocker — every
surface degrades honestly on its own) track what's due a check or worth a Route Watch send.

## Design system

Colours, type and spacing are defined once in `tailwind.config.js` and `app/globals.css` — no inline hex values or magic numbers elsewhere in the codebase. If you need to adjust the brand palette, that's the only file to touch.

- **ink** — near-black navy, used for dark sections and body text
- **brass** — warm gold accent, primary CTA colour
- **terracotta** — secondary accent, used for eyebrows and category labels
- **sand** — warm off-white background

## No fabricated content

Every statistic, price, and claim in this codebase is either factual, clearly marked as indicative with a checked date, or a placeholder explicitly called out as such (see the header comment in `/data/fare-observations.ts`, the source of truth for every price shown, and this README). There is no "50,000+ travellers," no invented urgency, and no claim that can't be traced to a real, editable data file.

## Deliberate scope decisions — what's not built, and why

A wishlist of "critical additions" was evaluated against this codebase as part of a full ownership-level audit. Several were deliberately **not** built. This isn't an oversight — building them now would have been the wrong call, and it's worth recording the reasoning so it isn't re-litigated by accident later.

**Built this pass:** fare alerts now genuinely capture a nearest-airport preference (see `components/sections/newsletter-section.tsx` and `app/api/subscribe/route.ts`), route comparison sections on route pages where real alternative-airport data exists, and the visiting-family content architecture was kept as the core differentiator rather than diluted with new verticals.

**Deliberately deferred — Hotels, Car Hire, Airport Lounges, Airport Parking.** Each of these needs either a live inventory/booking integration or genuine local-market knowledge this codebase doesn't yet have. Shipping them now with placeholder content would repeat the exact mistake that kills early-stage travel sites: going wide and shallow instead of finishing the core network first. Revisit once the 16 core routes are live, indexed, and converting — not before.

**Worth adding once traffic exists — eSIMs, Travel Insurance.** Both are low-build-cost affiliate plays (a single resource page each, not a full vertical) and can be added quickly once there's an audience to serve them to. Don't build ahead of demand.

## Running Travel Club — what the "fare alerts" promise actually requires

Travel Club (`app/travel-club/page.tsx`, `components/sections/newsletter-section.tsx`) deliberately does **not** claim automated live price tracking, because no such backend exists. What it promises instead is two manual things, both genuinely deliverable but requiring you to actually do them:

1. **Fare alerts**: when you log a new entry in `data/fare-observations.ts` meaningfully better than what's been shown before, segment your email list by the `TRAVEL_INTEREST` and `NEAREST_AIRPORT` contact attributes (captured at signup) and send a short, honest email to the relevant segment only — not your whole list.
2. **New route alerts**: when you add a new entry to `data/routes.ts`, do the same — email the segment tagged with that region.

If you don't intend to do this manually on an ongoing basis, soften the Travel Club page's copy further rather than leaving a promise unfulfilled — an unfulfilled "we'll tell you" is worse for trust than not promising it at all.

Actual email templates for the welcome, first-value, and re-engagement emails — written to be sent manually,
with guidance on when to send each — live in `docs/travel-club-email-sequence.md`.

**No double opt-in is currently configured.** The `POST /v3/contacts` call in `app/api/subscribe/route.ts` adds a contact directly — it does not trigger a confirmation email by itself. If you want double opt-in (recommended for deliverability and GDPR consent records), set it up in Brevo directly: either build the sign-up form in Brevo's own form builder with "Double confirmation" enabled, or create a Brevo Automation workflow that watches for "contact added to list" and sends a confirmation email with a opt-in link. The application code cannot configure this from outside Brevo's dashboard — don't add UI copy implying a confirmation email exists until one actually does.

## Verified route and airport claims

Every route added in this audit pass was checked against real airline schedule data before being written into `data/routes.ts` — not assumed from the brief. Two corrections worth flagging explicitly:

- **Leeds Bradford → Islamabad is not currently a stable direct service.** Conflicting reports exist (a 2025 PIA announcement, a collapsed start-up airline under CAA investigation, and multiple current sources confirming no direct service exists today). This route is modelled as **connecting**, not direct, and the instability is described honestly in the route's own copy rather than asserted as settled fact.
- **Manchester → Jeddah and Birmingham → Madinah are connecting routes**, not direct — both require a change at Doha, Istanbul, or Jeddah depending on carrier. Written accordingly.

If you update `data/routes.ts` or `data/airports.ts` in future, verify new route claims the same way — a named UK city pair existing in a press release is not the same as a stable, bookable, ongoing service.

## Time-bound direct services — the Route Status V1 ledger and `connectingAlternative`

Some direct routes have a publicly announced service change — for example, IndiGo's Manchester–Delhi and Manchester–Mumbai services, both launched in 2025, with a change IndiGo has announced with effect from 31 August 2026. A plain `isDirect: true/false` boolean can't represent this honestly: the route is genuinely direct *today*, and an announcement is not proof of what happens on the date it names.

This is modelled in the append-only Route Status ledger, `data/route-status-events.ts` — never as a field on the `Route` record itself. `getRouteStatus(route, routeStatusEvents, nowIso)` (`data/routes.ts`) derives the route's current status from the ledger (`verified-direct`, `withdrawal-announced`, `service-ended`, or `verification-pending`), and `getEffectiveRoutePresentation()` is the one adapter every public surface calls to render it consistently. The route page (`app/routes/[slug]/page.tsx`) renders a sourced, evidence-cited panel from `lib/route-status-copy.ts`'s `getRouteStatusCopy()` whenever a route is ledger-managed and its status isn't a routine "verified direct."

Previously, a currently-direct route with an announced end date was modelled via `Route.directServiceEndDate`/`directServiceEndNote` fields, rendering a banner directly from route data. Those fields have been removed entirely: keeping them as a second, parallel mechanism alongside the ledger would recreate exactly the second-source-of-truth risk the ledger exists to prevent. Every route with a scheduled service change — direct or otherwise — is modelled in the ledger now.

**Appending a new withdrawal/service-ended event:** add a new, fully sourced `RouteStatusEvent` to `data/route-status-events.ts` (see that file's header comment for the exact invariants — an announcement is never proof of occurrence; only a freshly verified `service-ended` event with `verifiedOccurrence: true` may assert a direct service actually ended). Do **not** edit `route.isDirect`, `route.airlineSlugs`, `route.frequency`, or `route.connectingAlternative` as part of this — the ledger event alone drives the safe public presentation, and `getRouteStatus()`'s airline-scoped derivation depends on `route.airlineSlugs` staying as the historical direct-operator record for the event to resolve against.

`connectingAlternative` — populated for any route where a realistic 1-stop (or 2-stop) alternative matters — remains entirely separate, editorial content, never auto-populated or implied by a withdrawal/service-ended ledger event. "Direct service ended" and "a connecting journey exists" are two separate facts requiring separate evidence: publishing a current connecting-service claim requires its own independent verification, not a consequence of appending a ledger event.

## Travel Ready Check — maintaining `data/travel-ready-rules.ts`

Travel Ready Check (JETSTASH_PRINCIPLES.md §14.3) answers "can I actually travel on these dates with the documents I have?" — passport validity and visa guidance across 7 countries (Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey, Morocco), British passport holders plus NICOP/POC and OCI document holders. Every fact lives in `data/travel-ready-rules.ts`, never scattered across components.

**To add or refresh a rule:**

1. Fetch the live official source yourself — GOV.UK foreign travel advice (`gov.uk/foreign-travel-advice/<country>/entry-requirements`) for passport validity, or the destination's own official visa portal for visa-requirement specifics. Never a blog, forum, or travel agency page, even if it looks current.
2. Update `requirement`, `minDaysValidityBeyondEntry`, `visaRequired`, `typicalProcessingDays` (only if the official source states a firm figure — leave it unset otherwise) and `caveat` to match what you actually read.
3. Set `lastVerifiedDate` to today and `reviewDueDate` 6 months out. Never bump these without re-checking the live source first — that's the exact stale-claim pattern §9 exists to prevent, applied to a compliance-adjacent feature where it matters more.
4. To add a new supported country, add its rules here **and** add it to `TRAVEL_READY_SUPPORTED_COUNTRIES` in `lib/travel-ready-check.ts` — the two must move together, or the destination selector and the decision tree disagree about coverage.

Once `reviewDueDate` passes, `isRuleStale()` makes the affected check degrade to "official confirmation required" automatically — check `/founder`'s "Travel Ready Check — rules ops" section for what's coming due.

## Data model & accumulation conventions

JetStash's differentiator versus a generic comparison site is accumulated, real history per route — not a bigger list of destinations. `route-timeline.ts`, `route-warnings.ts`, `fare-observations.ts`, `booking-windows.ts`, `airport-notes.ts`, `traveller-tips.ts` and `community-notes.ts` all follow the same rule:

- **Append, never overwrite.** When a fare changes, add a new `FareObservation` with a later `observedDate` — don't edit the old one. When a warning stops applying, flip its `status` to `'resolved'` rather than deleting it.
- **Only add an entry once it's a real, sourced fact.** Every seeded entry in these files was migrated from prose that was already stated elsewhere in the codebase (a route's `intro`/`bookingWindowNote`, an airport's old `practicalNotes`) — none of it was invented to fill a gap. Keep it that way: a plausible-sounding fare, warning, or tip is exactly the kind of fabricated content this project's "No fabricated content" rule (above) exists to prevent.
- **Reference canonical tables instead of retyping strings.** `data/airlines.ts` and `data/peak-periods.ts` exist because free-text airline names and peak-period labels had already drifted (e.g. `'UK summer holidays (Jul–Aug)'` vs `'UK summer holidays'`) across `routes.ts` and `destinations.ts`. New routes should reference `airlineSlugs`/`peakPeriodIds`, adding a new canonical entry first if one genuinely doesn't exist yet — never re-typing a new label inline.
- **Empty is honest.** `data/community-notes.ts` ships empty on purpose — there's no submission pipeline yet, and fabricating "traveller" testimonials would violate the same rule as a fabricated price. `components/route/community-notes-panel.tsx` renders a plain "not yet" state rather than pretending otherwise; follow that pattern for any other section that doesn't have real content yet.
- **Freshness thresholds live in one place.** `lib/freshness-thresholds.ts` defines `OBSERVATION_FRESH_DAYS`/`OBSERVATION_STALE_DAYS`/`SERVICE_END_WATCH_DAYS`/`RULE_REVIEW_WATCH_DAYS` and the `getFareFreshnessState()` helper every fare-rendering component uses — change a threshold there, not in the component that happens to render it. A copy-paste `FareObservation` template lives at the top of `data/fare-observations.ts` for fast logging, and a weekly Vercel Cron (`app/api/cron/fare-check-reminder/route.ts`) emails a reminder for any priority route past due — see JETSTASH_PRINCIPLES.md §14.4 for why automated fare *collection* itself isn't currently safe.

## Future expansion opportunities

Recorded here so they aren't silently dropped, not because they're scheduled:

- **Bangladesh is a named target market with zero current content.** Adding Dhaka/Sylhet/Chattogram routes needs the same real-schedule verification described above under "Verified route and airport claims" before anything goes into `data/routes.ts` — don't infer routes from demand alone.
- **A real community-notes submission pipeline.** Currently schema-only and empty (see above). Needs a submission form and a moderation step — a genuine scope increase since this project has no database today.
- **eSIM and travel insurance affiliate pages**, already identified as "worth adding once traffic exists" — revisit at a defined traffic trigger rather than building ahead of demand.
- **Promoting Turkey, Morocco and Saudi Arabia to first-class `RegionGroup`s** (they currently sit inside the broader `mediterranean`/`north-africa`/`gulf` groupings) once there's enough route depth in each to justify a dedicated hub, rather than adding hub pages ahead of the content that would fill them.

