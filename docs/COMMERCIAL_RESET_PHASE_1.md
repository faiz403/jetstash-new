# JetStash Commercial Reset — Phase 1

**CEO strategy, brand recovery and homepage concept. Prepared 2026-07-14. Production not modified.**

---

## 1. One-sentence commercial diagnosis

JetStash has built real evidence infrastructure (route verification, fare-freshness gating, passport/visa
readiness, booking-window intelligence) but wraps it in a homepage that behaves like a content catalogue
with no primary product, no first-viewport action, three under-built revenue lanes (Business Class has no
lead-generation mechanism at all; Umrah's is a manual email with no confirmed partner economics; Economy
depends on a single affiliate partner with an unknown commission rate), and a visual identity that reads as
an informal travel blog rather than the "checked before you book" intelligence service its own data model
already earns the right to claim.

---

## 2. Current homepage content map

Read directly from `app/page.tsx` and every section component it renders (`RouteMapHero`,
`NextTravelMomentRibbon`, `NewsletterSection`, `HubCard`, `DealCard`). Sixteen sections before the footer.
Height is an approximate count of 375px-wide mobile viewports per section, based on the section's own
padding tokens (`py-16`/`py-24` etc.), grid row counts and known component sizes (the Route Atlas SVG
alone is close to two full viewports at mobile width including its chip selector and legend).

| # | Section | Approx. mobile height | Primary purpose | Primary CTA | Revenue-capable? | Belongs on homepage? | Recommendation |
|---|---|---|---|---|---|---|---|
| 1 | Hero | 1.2 vh | Brand statement, entry point | "Explore destinations" (browse) | No | Yes | Replace CTA with the route-check product; keep the statement, cut the copy |
| 2 | Route Atlas (`RouteMapHero`) | 2.0 vh | Manchester-only visual wayfinding | "Explore destination" (per hover/tap) | No | Partially | Compress to a small strip or remove; full atlas belongs on `/airports/manchester`, which already exists as its natural home |
| 3 | Next Travel Moment ribbon | 0.4 vh | Book-By awareness | "See when to book" | Indirect | Yes, as a concept | Fold into the new Check result state instead of a separate strip |
| 4 | Travel Ready Check strip | 0.15 vh | Awareness only | Text link | No | Yes, as a concept | Fold into the new Check flow as a state, not a standalone line |
| 5 | "How we work" trust strip | 0.5 vh | Trust | None | No | Partially | Compress to one line under the hero; remove as its own section |
| 6 | Region hubs (4 cards) | 1.3 vh | Browse by region | Card click | No | Yes | Keep, move down, reduce to what fits one clean row |
| 7 | "Most-searched UK routes" (4 route cards) | 1.3 vh | Route browse | "View route" | No | Yes, rename | "Most-searched" is not backed by analytics anywhere in this codebase — rename to "Routes we track" or similar; the 4 featured slugs (`london-heathrow-delhi`, `manchester-lahore`, `manchester-dubai`, `london-heathrow-jeddah`) do **not** include Mumbai on either UK gateway |
| 8 | "Featured fares" (3 deal cards) | 1.3 vh | Show fares | "Check live price" | Yes (affiliate click) | **No, as currently labelled** | Every one of the 34 public deals currently shows "No fare checks logged yet" (TR-002 completeness gate). A section titled "Featured fares" showing zero fares is the exact violation the brief names in item 8 — remove the section or replace it with a genuinely fare-free "check this route" card that doesn't claim to be about fares |
| 9 | "Visiting family" (Lahore + Amritsar) | 1.4 vh | Editorial/emotional | Hub links | No | Marginal | Relocate to the Pakistan/India hub pages, where this content already has a natural, deeper home |
| 10 | Business Class (2 deal cards) | 1.1 vh | Upsell | "Explore business class" | **Not currently** — see §3 | Yes, prominence wrong | Move to the first two viewports; give it an actual enquiry path (none exists today, see finding below) |
| 11 | Umrah (1 deal + quote CTA) | 1.1 vh | Lead generation | "Request a quote" | Yes | Yes, prominence wrong | Move up; this is the one section on the homepage with a working lead-gen CTA already in place |
| 12 | Turkey/Morocco/Med (4 destination cards) | 1.2 vh | Browse | "View guide" | No | Marginal | Relocate to `/destinations` |
| 13 | "Why JetStash" (3 cards) | 0.9 vh | Trust, repeats hero's promise | None | No | No | Remove — restates the hero and the trust strip a third time with no new information |
| 14 | Manchester promo + latest guides | 1.1 vh | Airport promo + editorial | "Explore Manchester" / "Read guide" | No | Marginal | Relocate guides to `/guides`; fold the Manchester promo into `/airports/manchester` |
| 15 | Final CTA ("Explore UK airports") | 0.5 vh | Generic CTA | "Explore UK airports" | No | No | Remove — redundant with the hero's own secondary link |
| 16 | Travel Club (`NewsletterSection`) | 1.0 vh | Email acquisition | "Join free" | Indirect | Yes | Keep, move up, compress |

**Running total: approximately 16.4 mobile viewports of section content before the footer**, plus header
chrome and a roughly 1.2-viewport footer — consistent with the founder's own finding from a ~27-screenshot
review (a full top-to-bottom capture pass at this length plausibly produces that many raw screenshots).
This independently confirms established problem 1 from source, not from the screenshots alone.

**Two further code-level findings not on the original 25-item list, both material to this report:**

- **Business Class has no lead-generation mechanism of any kind.** `app/business-class/page.tsx` renders
  deal cards (all affiliate-click, via `DealCard`/`TravelUp`) and a `NewsletterSection` — nothing else.
  `lib/quote-request-options.ts`'s `QuoteTripType` union is `'umrah' | 'family-trip' | 'group-travel'` —
  there is no `'business-class'` option. The brief's request to evaluate "Business Class lead generation"
  as an existing revenue lane cannot be answered from what exists today, because it doesn't exist; it has
  to be built. This is reflected in §5's lane assessment.
- **`route.flightTime` on `london-heathrow-jeddah` literally reads** `'6h 15m direct (per BA\'s own
  destination page)'` **(`data/routes.ts:209`)** — internal sourcing methodology rendered directly as
  customer-facing flight-duration text on both the route page and every Jeddah deal card. This is the
  exact defect named in established problem 10, now traced to its exact source line.

---

## 3. Existing conversion-funnel map

Traced by reading the actual component tree and API routes, not assumed.

| Path | Steps from homepage | Approx. scroll depth | Notes |
|---|---|---|---|
| **1. Economy affiliate click** | Scroll to "Most-searched routes" (viewport ~5) or "Featured fares" (viewport ~6) → click a card → route page → "Check live price" (TravelUp) | 2 clicks, ~5-6 viewports | The "Featured fares" cards currently show no fare, so the click carries no price information — same outcome as clicking a bare route card |
| **2. Business Class enquiry** | Scroll to viewport ~10 → "Explore business class" → business-class page → **no enquiry form exists** → same TravelUp affiliate click as economy, or fall through to the Travel Club signup at the bottom of that page | No true enquiry path exists | This funnel terminates in the same affiliate click as economy; there is no qualified-lead capture step to model |
| **3. Umrah enquiry** | Scroll to viewport ~11 → "Request a quote" button links directly to `/quote-request?tripType=umrah&region=gulf` | 1 click, ~11 viewports | The only homepage section with a genuine working lead-gen CTA in place today, buried at roughly two-thirds down the page |
| **4. Route Watch signup** | **Not present on the homepage at all.** `RouteWatchForm` (POSTs to `/api/route-watch`, a separate Brevo list from Travel Club's `/api/subscribe`) is embedded on route pages and the Travel Ready Check page only | Not reachable from the homepage | The homepage instead promotes "Travel Club" (`NewsletterSection`, viewport ~16) — a second, separate acquisition mechanism with its own list. Two different subscribe products compete for the same "leave your email" moment without the homepage ever explaining the difference |
| **5. A useful route decision** (e.g. Manchester–Mumbai, Heathrow–Mumbai) | Requires either: (a) finding Mumbai's chip in the Route Atlas's 13-item destination list (7th position, mobile-only horizontal scroll), or (b) navigating to `/routes` or `/india` directly | Not reachable in "two purposeful interactions" today | `featuredRouteSlugs` in `app/page.tsx:55` — the array driving the "Most-searched" section — is `['london-heathrow-delhi', 'manchester-lahore', 'manchester-dubai', 'london-heathrow-jeddah']`. Mumbai is absent from both featured slots. This is the literal, code-level cause of established problems 6 and 7 |

---

## 4. Competitor research

Four categories, current public sources (search performed 2026-07-14).

### Flight search and comparison

**[Skyscanner](https://www.skyscanner.net)** — core promise: compare every airline/OTA at once. Primary
homepage action: an origin/destination/date search box, front and centre, zero scroll. Revenue model:
affiliate commission on referred bookings (flight metasearch is ~78% of Skyscanner's revenue; ~£390m
2025 revenue per Statista-sourced estimates) plus a stated push toward direct-booking margin capture.
Trust mechanism: scale and price transparency, not editorial voice. **What JetStash cannot realistically
beat:** search coverage, live pricing, brand recognition. **Where JetStash could differ:** Skyscanner has
no opinion on *when* to book or *whether your documents are ready* — it answers "what does this cost
today," never "should you act now." *(Sources: [miracuves.com](https://miracuves.com/blog/skyscanner-revenue-model/), [Statista](https://www.statista.com/statistics/952998/skyscanner-revenue-by-source/))*

### Flight-deal and alert memberships

**[Jack's Flight Club](https://jacksflightclub.com)** — core promise: "we'll email you when a genuinely
cheap fare appears." Primary homepage action: email capture, with a paid tier (£48/year) for faster/more
alerts. Revenue model: subscription (freemium → premium), reportedly 1m+ UK/EU/US members. Trust
mechanism: a named "Jack" and manually curated deals, not an algorithm. **What JetStash cannot realistically
beat:** deal-sourcing volume and a >1m-strong list. **Where JetStash could differ:** Jack's Flight Club is
airport-agnostic and route-agnostic — it does not specialise in the Pakistan/India/Gulf/Umrah corridors or
carry document-readiness intelligence. JetStash's Route Watch is the same "tell me when it's worth acting"
mechanic, narrowed to routes it actually understands in depth. *(Source: [jacksflightclub.com](https://jacksflightclub.com/flashpack), member-count and pricing as stated on their own site)*

### UK long-haul and diaspora travel agencies

**Southall Travel, Mushtaq Travel, On Time Travel, UK to Pakistan Travel Guide** — core promise: "we know
this specific route and community." Primary homepage action: phone number and a route-specific search/quote
form, not a generic search box. Revenue model: ATOL-protected package/flight sales with agent-negotiated
fares, typically commission or markup on the ticket. Trust mechanism: community reputation, phone
accessibility, ATOL protection. **What JetStash cannot realistically beat:** direct fare negotiation,
ATOL-protected package sales, phone-based trust with an older or less digitally-fluent segment of the
diaspora. **Where JetStash could differ:** these sites are functional but visually and structurally dated;
none appear to publish evidence-dated route/booking-window intelligence the way JetStash's data model
already supports — JetStash's edge is transparency and timing guidance, not price negotiation it cannot
actually perform (it has no ATOL licence, no fare-negotiation capability, and only one affiliate partner).
*(Source: [aviationweek.com](https://aviationweek.com/air-transport/airports-networks/pia-resume-uk-flights-indigo-adds-manchester-london-routes) on diaspora demographics; individual agency homepages reviewed directly)*

### Business Class and Umrah enquiry businesses

**[Business Class Consolidator](https://businessclassconsolidator.com)** (BCC) — core promise: discounted
business fares via consolidator-negotiated rates. Primary action: a quote/callback form. Revenue model:
markup on negotiated consolidator fares (a fundamentally different mechanism from an affiliate commission —
BCC is itself the ticketing agent). **AlHaram Travel, Zaitoon Travel, GM Travel, Al Habib Travel** (Umrah) —
core promise: full-package Umrah with ATOL protection. Primary action: WhatsApp or phone quote enquiry,
typically same-day human response. Revenue model: package markup, sometimes with an optional business-class
flight upgrade bundled in. **What JetStash cannot realistically beat:** actual ticketing/consolidator
capability, ATOL protection, an existing WhatsApp-first relationship with the Umrah community. **Where
JetStash could differ:** none of these sites appear to publish anything like Travel Ready Check (document
readiness) or Book-By Countdown (evidence-dated booking-window guidance) — they sell, they do not first
help a traveller understand their own situation. *(Sources: [businessclassconsolidator.com](https://businessclassconsolidator.com/), [sunaan.com Umrah agency roundup](https://sunaan.com/blogs/threads/5-best-umrah-travel-agencies-for-2026-packages-from-the-uk), individual agency sites)*

### Testing "Check the route before you book"

The proposition holds up against every category above **only as a positioning wedge, not as a moat**:
JetStash has no unique data no one else could gather, no proprietary fare feed, and no ATOL licence. What
it has that none of the four groups combine in one product is: dated, checked-by-a-person fare evidence;
document-readiness (Travel Ready Check); evidence-based booking-window timing (Book-By); and
route-verification honesty (this codebase's entire Truth Reset). Recommendation: **keep the proposition,
but frame it as a decision aid that ends in a real action (affiliate click or enquiry), not as a
research-only destination** — the four competitor groups all convert faster than JetStash's current
16-viewport homepage does.

---

## 5. Defining the business

**Most valuable initial customer:** a UK-based Pakistani or Indian diaspora traveller (or their
UK-resident family member booking on their behalf) planning a family-visit, wedding-season, or Eid/Diwali
trip who is price-sensitive but document-anxious — this segment is where JetStash's actual built depth
(NICOP/OCI guidance, peak-period booking windows, route-specific evidence) concentrates, and where generic
tools like Skyscanner offer no help beyond price.

**Their main booking problem:** knowing *when* to book (before a peak-period price surge) and *whether
their documents will be ready in time* — not just finding a price. Google Flights/Skyscanner answer "what
does it cost right now" and stop there.

**Which JetStash feature addresses it:** Book-By Countdown (evidence-dated booking-window guidance) +
Travel Ready Check (document readiness) combined at the point of decision, which no competitor reviewed
above offers as one product.

**Revenue action:** an affiliate click to TravelUp (economy) or a qualified lead handed to a partner
(Business Class, once built; Umrah, already built).

**Why they'd return:** Route Watch / Travel Club, if the signal is genuinely useful and not noise — this
depends entirely on whether the "curated, not automated" promise (CLAUDE.md) is operationally kept.

### Revenue lanes, evaluated separately

| Lane | Customer intent | Value/conversion | Operational requirements | Partner dependencies | Trust risks | Traffic requirement | Time to revenue | Supported today? |
|---|---|---|---|---|---|---|---|---|
| 1. Economy affiliate | Cheapest fare, fast | Low per-click, CJ commission rate **unknown — founder input required** | None beyond what exists | TravelUp (sole partner; Skyscanner declined pre-launch) | Single point of failure if TravelUp's programme changes | High volume needed (see model below) | Immediate — link already live | **Yes** |
| 2. Business Class lead-gen | High-value, wants a human to handle a complex fare | High per-conversion, but **no partner/commission arrangement exists in code or docs** | Build a quote form + a receiving partner relationship | **None currently — must be sourced** (e.g. a consolidator like BCC, or TravelUp's own business-class inventory if it exists) | Promising a "quote" with no partner to fulfil it is a real trust risk | Lower volume, higher intent needed | Not immediate — partner sourcing required first | **No — must be built** |
| 3. Umrah lead-gen | Full package, wants human curation, ATOL trust | High per-conversion if closed, but **close rate and any partner commission are unknown — founder input required** | Already built (`/quote-request`) | **None confirmed** — `/api/quote-request` emails the founder for manual follow-up; no named fulfilment partner in code or docs | Promising "real quotes from a person" when fulfilment/partner economics are undocumented is the exact kind of claim this codebase's own Truth Reset exists to prevent elsewhere | Lower volume, higher intent | Depends entirely on an undocumented manual process | **Partially — form exists, economics do not** |
| 4. Route Watch email acquisition | Not ready to book, wants to be told when | Zero direct revenue; a feeder into lanes 1-3 | Already built, but genuinely manual curation per CLAUDE.md ("a person reviews what's worth sending") | None | Manual curation must actually happen at whatever volume signups reach, or the promise breaks | Scales with traffic | Long — value is downstream | **Yes, but not on the homepage today** |
| 5. Future paid concierge/briefing | Wants a human to plan the whole trip, will pay for it | Highest per-conversion if it exists | Does not exist. Requires a pricing model, a delivery mechanism, and someone to actually produce the briefing | None | Charging for something not yet built or tested is the single highest-risk lane here | Very low volume, very high intent | Long — needs a pilot first | **No — concept only** |
| 6. Later-stage hotel/transfer/insurance | Add-on to an already-booked trip | Small per-conversion, aggregates over volume | New partner relationships required | To be sourced | Low, if disclosed the same way existing affiliate relationships are | Needs an established, returning user base first | Long — sequenced after 1-4 mature | **No — not yet relevant** |

### Unit economics — conservative / base / upside

All formulas as specified in the brief. **Every input below is either sourced (cited), founder-supplied
(flagged), or explicitly unknown (flagged).** Nothing here is invented to look favourable.

**Economy affiliate revenue = sessions × route-check completion × live-price click rate × partner booking
conversion × net commission**

| Input | Conservative | Base | Upside | Source |
|---|---|---|---|---|
| Monthly sessions | 2,000 | 8,000 | 25,000 | **Unknown — no current analytics data was available to this pass; founder input required for actual traffic** |
| Route-check completion rate | 15% | 25% | 35% | Estimated from general flight-tool engagement patterns, not JetStash-specific data — **assumption** |
| Live-price click rate (of completions) | 20% | 35% | 50% | **Assumption**, informed by typical metasearch click-through ranges |
| Partner booking conversion (of clicks) | 1.5% | 3% | 5% | Typical OTA/affiliate booking-conversion range cited across travel-affiliate industry commentary — **not JetStash-specific, treat as illustrative only** |
| Net commission per booking | £8 | £15 | £25 | **Unknown — JetStash's actual CJ/TravelUp commission rate is not documented anywhere in this codebase or its docs; founder input required** |
| **Monthly result** | **~£4** | **~£315** | **~£5,469** | Illustrative only until the two flagged unknowns are filled in — the conservative/upside spread is this wide specifically *because* the commission rate is unverified |

**Business Class revenue = sessions × Business Class interest × enquiry completion × qualified-lead rate ×
close rate × net commission**

This lane **cannot be modelled with any confidence today** because two of the six inputs
(enquiry-completion mechanism, and any partner/commission arrangement) do not exist yet. Any number
produced here would be fabricated. **This is intentionally left unmodelled — see §17, decision required.**

**Umrah revenue = sessions × Umrah interest × enquiry completion × qualified-lead rate × close rate × net
commission**

| Input | Conservative | Base | Upside | Source |
|---|---|---|---|---|
| Monthly sessions to Umrah-relevant pages | 300 | 1,200 | 4,000 | **Unknown — founder input required** |
| Umrah interest (click into quote flow) | 5% | 10% | 18% | **Assumption** |
| Enquiry completion (of clicks) | 40% | 60% | 75% | **Assumption**, form is short |
| Qualified-lead rate (of completions) | 50% | 70% | 85% | **Assumption** |
| Close rate (qualified lead → booked) | **Unknown — no partner or historical close-rate data exists** | | | **Founder input required** |
| Net commission/margin per booking | **Unknown — no partner arrangement is documented** | | | **Founder input required** |

**Conclusion on prominence:** given the two flagged unknowns that block Business Class and Umrah economics
entirely, and given Economy's single-partner, unverified-commission dependency, **no lane currently
justifies confident revenue prominence on evidence alone.** The recommendation below is therefore a
*sequencing* decision, not a revenue-ranking one: **Economy affiliate deserves the most homepage
prominence in the next 90 days because it is the only lane that can generate real revenue today without
further partner work; Umrah deserves the second-most prominence because its lead-gen mechanism already
exists and only needs its economics understood, not built.** Business Class should be present but framed
honestly as "tell us what you need" rather than implying an existing fulfilment relationship, until §17's
decision is made.

---

## 6. Recommended proposition

**"Your route, checked before you book."**

Tested against the competitor set in §4: distinct from Skyscanner (price only), Jack's Flight Club
(deal alerts only, not route-specific), diaspora agencies (negotiation, not evidence), and Business
Class/Umrah consolidators (fulfilment, not decision support). No stronger alternative proposition emerged
from the research that a) is true today and b) doesn't just restate "we're honest," which the brief
correctly identifies (item 23) as something the product should demonstrate, not repeat.

---

## 7. New homepage information architecture

1. Compact header — readable wordmark, one primary CTA
2. **The JetStash Check** hero — departure airport, destination, month, cabin, "Check my route"
3. Three commercial paths — Search economy fares / Request a Business Class quote / Request an Umrah quote
4. A few genuinely supported route-intelligence examples (not a catalogue)
5. One concise "what JetStash checks" explanation
6. Route Watch signup
7. A compressed selection of specialist hubs/guides
8. Compact footer

Target: 7-9 mobile viewports before the footer, against today's ~16.4 (§2).

---

## 8. Retain / compress / relocate / remove matrix

| Content | Action | New home |
|---|---|---|
| Route Atlas (full SVG map) | Relocate | `/airports/manchester` (its natural, already-existing home) |
| "Featured fares" with zero fares | Remove | N/A — replace with an honest "check this route" prompt, never labelled "fares" until real ones exist |
| "Visiting family" manifesto + 2 destination cards | Relocate | Pakistan/India hub pages |
| Turkey/Morocco/Med 4-card catalogue | Remove | `/destinations` |
| 3 editorial guide cards | Relocate | `/guides` |
| "Why JetStash" trust cards | Remove | Redundant with hero + trust strip |
| Manchester airport promo | Relocate | `/airports/manchester` |
| Final generic CTA | Remove | Redundant with hero |
| "How we work" trust strip | Compress | One line under the hero |
| Region hub cards | Compress, keep | Homepage, lower position |
| Business Class | Compress, elevate position | Homepage hero cabin control + dedicated path, viewport 2-3 |
| Umrah | Compress, elevate position | Homepage dedicated path, viewport 2-3 |
| Travel Club signup | Compress, elevate position | Homepage, mid-page, once genuine Route Watch/Travel Club product overlap is resolved (see §17) |

---

## 9. Brand recommendation

**Logo:** retire the circular "A" mark (`components/ui/logomark.tsx`) — a stylised peak shape with no
stated or visible relationship to "JetStash," a route, a waypoint, or stored intelligence. Three directions
were developed in the concept (see §12 and the brand board); the recommended direction is **"The
Waypoint,"** a coordinate-pin-derived mark built from two intersecting flight-path lines meeting at a
single point, doubling as a literal "J" negative-space read at header size. All three test clean at
favicon size, work in one colour, and were built as hand-authored SVG (no raster/AI-image output used).

**Typography:** remove Fraunces (`font-display`) from body copy, forms, evidence text, prices and labels —
confirmed via source inspection that it currently drives every `h1`-`h4`, numbered-list index (e.g. the
"01", "02" route-card counters), and would style prices and form labels identically to headings if used
there. Restrict it to major page headings only. Public Sans (`font-sans`) becomes the workhorse for
everything functional: prices, labels, evidence, navigation, forms.

**Colour:** source inspection of `tailwind.config.js` and every component found no first-party
green/yellow/red token in the design system itself — the palette as defined (`ink`, `brass`, `terracotta`,
`sand`) is restrained. One confirmed, deliberate exception exists: `whatsapp-share-button.tsx` hardcodes
WhatsApp's real brand green (`#25D366`) as a hover state, per CLAUDE.md's documented allowance. **This does
not fully explain the founder's live-screenshot finding of neon green/yellow/dark-red competing across the
page** — the remaining cause is most plausibly native OS/browser chrome (mobile date-picker accent colours,
autofill yellow, native focus rings), which this codebase's CSS does not control and which vary by device.
**Labelled as unknown, not resolved, per instruction 15.** The concept's palette keeps ink/brass/sand as the
base and reduces to one single, consistent action colour (brass) for every primary CTA — no case in the
concept where "primary" means a different colour in two places.

**Photography:** the concept avoids a heavy dark wash on every image, uses text-safe crop regions rather
than a blanket overlay, and does not add an aircraft graphic on top of every destination photo.

---

## 10. Exact concept decisions

- **Hero product:** the JetStash Check — 4 inputs (departure airport, destination, month, cabin) + 1
  action ("Check my route"). No live price is claimed at this step; it routes to a result state.
- **Result states built:** verified-direct, verification-pending (paired correctly with no unsupported
  "Direct" wording), zero-publishable-fare, Business Class path, Route Watch signup.
- **Priority routes surfaced:** Heathrow–Mumbai (per-airline evidence shown, no unsupported BA frequency),
  Manchester–Mumbai (its `directServiceEndDate: '2026-08-31'` shown honestly, not hidden), Manchester–Lahore
  (verified direct), Birmingham–Mumbai shown as a **coverage-request state**, not a fabricated live route
  page — TR-017 remains open and is not worked around here.
- **"Most-searched" wording removed entirely** from the concept; replaced with "Routes we track."
- **Source disclosure:** moved to a secondary "How we checked this" expandable, never inline in the route
  headline (fixes the Jeddah `flightTime` defect at the concept-copy level; the actual data-field fix
  remains a separate, future code change under the existing Truth Reset process, not made in this pass).

---

## 11. Analytics plan

Current state: **10 `data-analytics` attributes exist sitewide** (Travel Ready Check: 5, Book-By: 4,
WhatsApp share: 1), wired through the single `track()` wrapper (`lib/analytics.ts`) over Vercel Web
Analytics. **Zero homepage-level events exist today** — no route-check, no business-quote, no umrah-quote
event of any kind.

New event model (demonstrated as inert `data-analytics` markup in the isolated concept, not wired to a
live backend, per "where practical"):

| Event | Fires when | Properties |
|---|---|---|
| `homepage_route_check_started` | First field of the Check form is touched | `placement` |
| `homepage_route_check_completed` | "Check my route" submitted | `origin`, `destination`, `cabin`, `month` |
| `route_result_viewed` | Result state renders | `route_slug` or `unsupported`, `verification_state`, `cabin` |
| `live_price_clicked` | Outbound affiliate link clicked | `route_slug`, `cabin`, `placement` |
| `business_quote_started` | Business enquiry form opened | `route_slug` (if known) |
| `business_quote_submitted` | Business enquiry submitted | `route_slug` (if known) |
| `umrah_quote_started` | Umrah enquiry form opened | `region` |
| `umrah_quote_submitted` | Umrah enquiry submitted | `region`, `trip_type` |
| `route_watch_started` | Route Watch form opened | `placement` |
| `route_watch_submitted` | Route Watch submitted | `origin`, `destination` |
| `unsupported_route_requested` | A Check result returns no coverage | `origin`, `destination` |

No property identifies a person or a document, matching the existing rule in `lib/analytics.ts`.

**First commercial dashboard** should track: route checks and completion rate; live-price
click-through; Business Class and Umrah enquiries; Route Watch signups; unsupported-route demand (this is
the single best signal for where to expand route coverage next — every "unsupported" check is a
demand signal JetStash currently discards); qualified leads/revenue by route; mobile conversion; return
visitors. **Page count, test count and build success are explicitly excluded as commercial KPIs**, per
instruction 14 — those measure that the product works, not that it earns.

---

## 12. 30 / 60 / 90-day commercial plan

**Days 1-30:** implement the analytics event model on the *existing* production homepage (no redesign
yet) to start collecting the traffic/completion data every unit-economics model in §5 is currently missing.
Fix the Jeddah `flightTime` sourcing-language defect (a one-line data change, separate from this phase).
Get founder decisions on the 5 items in §17.

**Days 31-60:** build the actual JetStash Check product and the new homepage IA behind a flag or on a
route not yet linked from navigation, using the real event model from day 1 to validate assumptions before
committing to the full redesign. Source a Business Class fulfilment partner or make an explicit decision
not to pursue that lane yet.

**Days 61-90:** ship the redesigned homepage once the JetStash Check has real usage data behind it, not
just this phase's hypothesis. Re-run the unit-economics models in §5 with real numbers instead of
assumptions.

---

## 13. Operational dependencies

- A Business Class fulfilment partner (does not exist today)
- Confirmed CJ/TravelUp commission rate (not documented in this codebase)
- Confirmed Umrah quote fulfilment process and any partner commission (not documented)
- Analytics implementation before any of the above numbers can be trusted
- A decision on Route Watch vs. Travel Club (two products, one moment, see §17)

---

## 14. Known facts, assumptions and unknowns

**Known (source-verified this pass):** current homepage section count and order; the missing Business
Class enquiry mechanism; the Jeddah sourcing-language defect; the "Most-searched" claim has no supporting
analytics; Karachi is described as "direct" on the homepage's Pakistan hub card despite remaining
unverified; the Route Atlas caption's "every route is real" absolute claim; the design-system colour
tokens contain no first-party green/yellow; WhatsApp's brand green is the one confirmed hardcoded
non-palette colour; only 10 analytics events exist sitewide, none on the homepage.

**Assumptions (flagged inline in §5):** all conversion-rate and click-through figures in the unit-economics
tables not tied to a citation.

**Unknowns (explicitly unresolved, founder input required):** actual monthly traffic; TravelUp/CJ
commission rate; Umrah quote close rate and partner economics; any Business Class partner relationship;
the full cause of the neon-green/yellow/red palette the founder observed live (WhatsApp's hover-state green
is a partial, not complete, explanation).

---

## 15. Founder decisions required (maximum 5)

1. **Business Class:** commit to sourcing a fulfilment partner and building a real enquiry mechanism, or
   explicitly deprioritise this lane until one exists — do not let the homepage imply a service that
   isn't there.
2. **Umrah economics:** confirm (or state as genuinely unknown) the close rate and any commission/margin
   on quote-request leads — needed before this lane can be prioritised with confidence rather than hope.
3. **TravelUp commission rate:** confirm the actual net commission per booking — every Economy revenue
   figure in §5 is illustrative until this is known.
4. **Route Watch vs. Travel Club:** merge into one product with one promise, or keep both and explain the
   difference on the homepage — the current silent duplication serves neither well.
5. **Approve or reject** the new homepage IA (§7) and brand direction (§9/§12) for a real (non-concept)
   implementation pass.

---

## Files created this phase

- `docs/COMMERCIAL_RESET_PHASE_1.md` (this file)
- `public/concepts/commercial-reset-2026-07/` — isolated concept (mobile homepage, desktop homepage, brand
  board, 6 named states), listed with exact filenames in the final response.

No production application file was created, modified, or deleted in this phase. `public/concepts/`'s
existing contents (`manchester-route-map-v1.html`, `manchester-route-map-v2.html`) are untouched.
