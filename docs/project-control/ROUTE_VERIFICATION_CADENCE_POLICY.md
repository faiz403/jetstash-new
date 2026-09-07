# Route Verification Cadence Policy

**Recorded:** 18 August 2026, following the Route Verification Cadence Policy Audit (which found the
prior cadence was a flat ~31-day window applied almost uniformly regardless of route stability) and
implemented immediately in Route Verification Refresh Batch 1 (`data/routes.ts`, PR pending).

## What this replaces

Before this policy, `Route.verification.reviewDueDate` was set at verification time with no written
rationale. 69 of 76 records (91%) shared the same ~31-day window whether the route was a
decades-old Emirates long-haul corridor or a brand-new seasonal service — the two longest-window
outliers (39 days) were, if anything, the two routes *most* likely to change soon (an active IndiGo
withdrawal-announced event). This produced a large, recurring monthly review backlog with no
risk-based differentiation, confirmed directly against the real data in the audit that preceded this
policy.

## The categories

| Category | Definition | Review window after a **fresh** qualifying evidence check |
|---|---|---:|
| **STABLE** | Established `verified` scheduled service, no active route-status event, no recent-launch/relaunch/seasonal instability found. | **90 days** |
| **RECENT / CHANGING** | Recent launch/relaunch, seasonal service, active withdrawal/frequency/status change, or otherwise materially change-prone (including a credibly-reported *upcoming* schedule change even if nothing has changed yet). | **30 days** |
| **CONNECTING / STRUCTURAL** | `verified` route fact depends on routing/stop pattern, absence of direct service, hub structure, or more than one fact remaining simultaneously true. | **45 days** |
| **DISPUTED** | Current, live, directly-checked primary-source contradiction. Status stays `unverified` until the contradiction genuinely resolves — the window is a founder review reminder, not an evidence-validity claim. | **14 days** |
| **NO-EVIDENCE** | No qualifying primary evidence has ever been found. Status stays `unverified` until new evidence is actually found. | No calendar cadence is honest here — treat any date on these records as a founder worklist nudge, never a freshness signal. |

## The rule that must never be broken

**A category judgement alone never extends evidence validity.** To assign a route a new
`reviewDueDate`:

1. Perform a fresh evidence check now, against a qualifying primary source (an airline's own route
   page, an airport's own destination page, an official press release/newsroom notice — never a
   Trip.com handoff URL, never an aggregator, never a single `FareObservation` treated as a route
   fact).
2. Record the new `verifiedDate` truthfully — the date the check actually happened.
3. Only then calculate `reviewDueDate` from the category's window above.

Taking an old verification and mechanically pushing its `reviewDueDate` further out because the
route *looks* stable — without a fresh check — is date-laundering. It is not permitted under this
policy, regardless of how confident the route appears.

**A route that cannot be reconfirmed is never administratively extended.** If a fresh check finds
the evidence insufficient or contradictory, the record is left exactly as-is (its existing, expiring
`reviewDueDate` stands) rather than manufacturing an update — the existing fail-closed mechanism
(`isCurrentClaimValid()` → `getEffectiveRoutePresentation()`, unchanged by this policy) already
handles what happens once it genuinely expires: a neutral "Verification pending" presentation, never
a stale "verified" claim continuing to show.

## Avoiding future clustering

Refresh routes in small, rolling batches — not one giant sweep. A single large batch merely
recreates the same clustering problem roughly one window-length later. See
`docs/project-control/DECISIONS.md` for each batch as it's recorded.

## Early-review triggers (override the normal window)

Using existing JetStash mechanisms only — no new monitoring system:

- A new entry appears in `data/route-status-events.ts` for the route (already surfaced by
  `serviceChangesStatus()` in `lib/founder-insights.ts`).
- A new or updated entry appears in `data/route-warnings.ts` (already surfaced by
  `warningsForReview()`).
- The founder personally notices a discrepancy while researching or browsing — the same
  "founder-directed recheck" pattern already used throughout `data/routes.ts`'s own verification
  notes.

## Batch history

### Batch 1 — 18 August 2026

Selected the 10 `verified`-status routes with the nearest `reviewDueDate`, excluding all
`unverified` (DISPUTED/NO-EVIDENCE) routes. Fresh primary-source evidence checks:

| Route | Outcome | Category | New window |
|---|---|---|---:|
| Manchester–Dubai | Reconfirmed | STABLE | 90d |
| Manchester–Doha | Reconfirmed | STABLE | 90d |
| Glasgow–Dubai | Reconfirmed | STABLE | 90d |
| Edinburgh–Dubai | Reconfirmed | STABLE | 90d |
| Newcastle–Dubai | Reconfirmed (frequency updated 6→7 flights/week, a genuine change found) | STABLE | 90d |
| London Heathrow–Doha | Reconfirmed | RECENT / CHANGING (a Qatar Airways spring-2026 schedule reduction was found reported for this pair) | 30d |
| London Gatwick–Amritsar | Reconfirmed | RECENT / CHANGING (precautionary — see below) | 30d |
| Birmingham–Mumbai | Reconfirmed (still no direct service) | CONNECTING / STRUCTURAL | 45d |
| Manchester–Dhaka | Reconfirmed (via-Sylhet pattern unchanged, prior suspension pre-dates both checks) | CONNECTING / STRUCTURAL | 45d |
| **London Gatwick–Ahmedabad** | **Corrected to DISPUTED / unverified — see below** | DISPUTED | 14d |

**London Gatwick–Ahmedabad — a genuine research correction, recorded honestly.** The first pass of
this batch mis-attributed a **2025**-dated Air India newsroom announcement ("Update on Air India's
international operations" — Ahmedabad–London moving from Gatwick to Heathrow, 1 August–30
September) as current 2026 operational fact. It is not: that announcement describes August–September
**2025**, not 2026, and the error was caught and corrected on founder review before this batch was
committed — exactly the kind of check this policy exists to encourage.

Re-inspecting the **current 2026** primary evidence instead found a genuine, unresolved
contradiction across Air India's own current surfaces: its own Ahmedabad–London booking page
presently resolves August 2026 schedule results to Heathrow, while a current Air India commercial
offer explicitly advertises Ahmedabad–London **Gatwick** travel valid through 31 December 2026, and
Air India's own May 2026 international network-rationalisation announcement (through August 2026)
does not list this route as moved. No confirmed 2026 relocation is established — only a real,
current conflict between Air India's own published surfaces.

**Correct action taken: reclassified `unverified` (DISPUTED) immediately, not left to expire on its
old 28 August date.** Leaving a record `verified` until an old calendar date lapses, once fresh
research has already shown the confident claim can no longer be supported, would itself be a
violation of this policy's own evidence rule — a category or status decision must reflect what the
evidence currently shows, not wait for an unrelated date. `verifiedDate` 18 August 2026,
`reviewDueDate` 1 September 2026 (14 days, the DISPUTED window), `isDirect` left at `true`
(structurally unchanged — directness has never varied here, only the departure airport is disputed)
while `flightTime`/`frequency` were set to the same "Unverified — see note" convention already used
elsewhere in this file (e.g. Birmingham–Ahmedabad). No route-status withdrawal/diversion event was
created, because no confirmed operational change has been established — only an evidence
contradiction, which the existing DISPUTED category already exists to represent honestly.

London Gatwick–Amritsar's classification (RECENT/CHANGING rather than STABLE) was a precaution: no
direct evidence was found that Amritsar itself is affected by the Safety Pause, but its sibling
Gatwick–India route (Ahmedabad) genuinely was, so the shorter window reflects elevated uncertainty
on the whole Gatwick–India corridor right now, not a confirmed problem with Amritsar specifically.

The six currently-overdue `unverified` routes (Manchester–Karachi, Birmingham–Lahore,
Birmingham–Islamabad, Heathrow–Dhaka, Manchester–Sylhet, Heathrow–Sylhet) were deliberately excluded
from this batch and left untouched — they need new primary evidence, not a cadence change, and
remain correctly fail-closed. See `docs/project-control/ROUTE_COVERAGE_AUDIT.md` (6 August 2026),
which named this exact set for the same reason.

### Batch 2 — 19 August 2026

Live primary-source research ran against 9 `unverified`/DISPUTED routes plus one routine
reconfirmation, followed by a targeted manual-resolution pass on the three most promising leads.
**Outcome: zero reclassifications.** This is a correct result, not a stalled one — the evidence
standard held, and every route that stayed unverified stayed unverified because the evidence
genuinely didn't clear the bar, not because it wasn't checked.

- **All 9 unverified/DISPUTED routes** (Heathrow–Dhaka, Heathrow–Sylhet, Birmingham–Delhi,
  Manchester–Sylhet, Birmingham–Ahmedabad, Gatwick–Ahmedabad, Manchester–Karachi,
  Birmingham–Lahore, Birmingham–Islamabad) remain unverified. No `status`, `verifiedDate`, or
  `reviewDueDate` changed on any of them — per this policy's own rule, a fresh check that comes
  back blocked, inconclusive, or merely reconfirming an already-recorded absence does not qualify
  for a new date. Seven records (Heathrow–Dhaka, Heathrow–Sylhet, Birmingham–Delhi,
  Birmingham–Ahmedabad, Manchester–Sylhet, Gatwick–Ahmedabad, Manchester–Karachi) got a concise,
  dated note addition where today's research genuinely added new directly-read evidence; the
  remaining two (Birmingham–Lahore, Birmingham–Islamabad) were left completely untouched, since
  today's re-check only reconfirmed a fact their notes already recorded.
- **Heathrow–Dhaka and Heathrow–Sylhet**: `verification.sourceUrl` corrected from a stale
  Terminal 3 Heathrow flight-detail URL to the Terminal 4 URL actually opened and confirmed live
  this session (Biman Bangladesh Airlines currently operates from Heathrow T4). Factual/source
  correction only — status, dates, directness and fare publishability all untouched.
- **Manchester–Mumbai**: reconfirmed as still operating, but `verifiedDate`/`reviewDueDate` were
  deliberately left unchanged. This record's load-bearing evidence is IndiGo's own 4 Feb 2026
  press release; today's directly-read check (Manchester Airport's own live Mumbai page, no
  service-suspended notice) corroborates the route is still running but does not itself reconfirm
  IndiGo's own schedule facts, so it does not meet this policy's bar for a fresh `verifiedDate`.
  The existing `reviewDueDate` (2026-08-31) was left as-is rather than mechanically extended to a
  RECENT/CHANGING 30-day window, since that would land after the already-tracked IndiGo withdrawal
  (`data/route-status-events.ts`, event `man-bom-indigo-withdrawal-2026-06`, effective the same
  2026-08-31 date) — extending it would imply the route stays valid past the date it's known to
  stop operating. The ledger event itself was not touched.
- **No suppressed fare was unlocked.** All nine archived fares logged against these routes stay
  suppressed, unchanged from before this batch.

### Batch 3 — 21 August 2026 (COV-001 verification-gap audit)

A founder-directed read-only audit of the 9 genuinely-unverified routes (`leeds-bradford-bodrum`
was included in the founder's request but turned out, on inspection, to already be a correctly
`verified` direct record with no Fare Signal purely because no fare has ever been logged — a
`FARE-001` gap, not a verification one; it was excluded from the audit's conclusions and is
untouched here), followed by a founder-approved narrow implementation pass reclassifying 4 of them.

**Reclassified from disputed-direct (`isDirect: true`, `unverified`) to verified-connecting
(`isDirect: false`, `verified`), CONNECTING/STRUCTURAL category, 45-day window:**

| Route | New evidence | Routing recorded |
|---|---|---:|
| Manchester–Karachi | Live search on PIA's own booking engine (book-pia.crane.aero), round trip, 1-15 Sep 2026 sampled: 10 results, zero nonstop. Routing was mixed (Islamabad on PIA metal; Dubai/Jeddah on Emirates/Saudia codeshare) across the sample. | Not fixed — the evidence does not support a single stable hub, so none is recorded as a durable fact; only "connecting" is. |
| Birmingham–Lahore | Same engine, BHX-LHE, same dates: 6 results, zero nonstop, 6 of 6 routed via Istanbul New Airport. | Istanbul (consistent across every sampled result) |
| Birmingham–Islamabad | Same engine, BHX-ISB, same dates: 6 results, zero nonstop, 6 of 6 routed via Istanbul New Airport. | Istanbul (consistent across every sampled result) |
| Birmingham–Delhi | Air India's own current page names AI118 as "(via ATQ)" — the same flight number Birmingham Airport's own 2019 press release already described as a Delhi/Amritsar tag-service. The two sources, read together, resolve what Batch 2 (19 August) had correctly left as an unresolved cross-source conflict. | Amritsar (Air India's own current page names it explicitly) |

**Evidence-scoping caution, applied deliberately:** for Manchester–Karachi specifically, the record
states only that no nonstop service appeared in the live results sampled on 21 August 2026 for the
1-15 September 2026 window — it does not assert PIA never operates a nonstop MAN-KHI service under
any circumstance. A live booking-engine search is schedule-and-codeshare-dependent at the moment of
query, not a permanent published timetable; this is why all four records use the CONNECTING/STRUCTURAL
45-day window rather than the STABLE 90-day window, and why Manchester–Karachi in particular
deliberately does not name a fixed via-city the way the two Istanbul-routed records do.

**Left deliberately untouched, exactly as before:** Birmingham–Ahmedabad (Air India's own page is
still internally self-contradictory — no new evidence resolved it), Gatwick–Ahmedabad (Air India's
Ahmedabad-London aggregator page now shows zero direct flights and no AI171, which is new but does
not cleanly resolve the LGW-vs-LHR question either way), Heathrow–Dhaka and Heathrow–Sylhet
(Heathrow's own tracker confirms BG202 operates but discloses no stop pattern, unchanged since 19
August; Biman's own site remains Cloudflare-blocked to automated access), and Manchester–Sylhet
(materially strengthened — Bangladesh's state news agency, citing a Biman press release, now
describes a real timed Sylhet stop on the Manchester rotation, corroborated by independent schedule
trackers and several OTAs — but Manchester Airport's own page, rechecked live the same day, is
unchanged and still states it is not currently flying there; the founder judged this not yet
resolved enough to act on).

**Correction (Big Review Clean-up Batch 1, 21 August 2026):** the sentence originally here — "none of
the four reclassified routes has ever had a fare observation logged" — was wrong and is corrected
now. All four routes DO have logged fare observations (Manchester–Karachi: `obs-man-khi-economy-
20260818-8w-v1`; Birmingham–Lahore: `obs-bhx-lhe-economy-20260818-8w-v1`; Birmingham–Islamabad:
`obs-bhx-isb-economy-20260818-8w-v1`; Birmingham–Delhi: `obs-bhx-del-economy-20260818-8w-v1` and
`obs-bhx-del-economy-20260813-8w-v1`). **No suppressed fare was unlocked by this batch** — that part
was correct — but the mechanism is deliberate suppression, not absence of evidence: reclassifying a
route from unverified to verified-connecting would have made these five observations pass
`isObservationPublishable()`'s route-status gate for the first time, so all five were added to
`methodologyExcludedObservationIds` (`data/fare-observations.ts`) the same PR, keeping them excluded
from `isPubliclyPublishable()` regardless of route status. They remain in the archive, correctly
attributed, pending a separate, deliberate founder decision on whether to unlock them — see
`STATUS.md`'s Current truth for that open item. Trip.com handoff logic was not touched.

### Batch 4 -- 7 September 2026 (12 September due-soon batch)

Fresh primary-source evidence checks against the 15 `verified`-status routes due 12 September 2026
(local-only, built on top of the direct-Vercel-deployed `integration/trust-route-fixes-2026-09-07`
production snapshot while GitHub remained suspended):

| Route | Outcome | New window |
|---|---|---:|
| Manchester-Dalaman | Reconfirmed, genuine upgrade (15 weekly flights, exact overnight timings) | RECENT/CHANGING, 30d |
| Manchester-Bodrum | Reconfirmed unchanged (Manchester Airport still states summer-only) | RECENT/CHANGING, 30d |
| Manchester-Antalya | Reconfirmed via Manchester Airport + SunExpress (Jet2/Corendon not re-checked -- bot-challenge) | RECENT/CHANGING, 30d |
| Manchester-Izmir | Reconfirmed via Manchester Airport + SunExpress corroboration | RECENT/CHANGING, 30d |
| Leeds Bradford-Antalya | Rechecked, identical to 4 Sept finding -- left completely untouched | unchanged (2026-09-12) |
| Leeds Bradford-Dalaman | Genuine upgrade -- Jet2 Holidays + TUI now named as operators | unchanged (2026-09-12; see below) |
| Leeds Bradford-Bodrum | Rechecked, identical to 4 Sept finding -- left completely untouched | unchanged (2026-09-12) |
| London Gatwick-Dalaman | Reconfirmed via the same SunExpress source, still live | RECENT/CHANGING, 30d |
| London Gatwick-Bodrum | Reconfirmed via the same SunExpress source, still live | RECENT/CHANGING, 30d |
| London Gatwick-Izmir | Reconfirmed via a different current SunExpress source (flight-plan PDF unreadable this session) | RECENT/CHANGING, 30d |
| **Manchester-Marrakech** | **Reclassified -- genuine year-round signal found** | **STABLE, 90d** |
| **Bristol-Marrakech** | **Reclassified -- named operators (easyJet, TUI) + explicit "all year round"** | **STABLE, 90d** |
| London Gatwick-Marrakech | No fresh non-stale evidence found -- left completely untouched | unchanged (2026-09-12) |
| London Gatwick-Agadir | No fresh non-stale evidence found (same finding as Batch 6) -- left completely untouched | unchanged (2026-09-12) |
| London Heathrow-Casablanca | Reconfirmed, but a real relative-prominence shift toward Stansted/Gatwick observed | RECENT/CHANGING, 30d |

**Leeds Bradford-Dalaman -- the same "thin-but-verified" pattern as the already-recorded Leeds
Bradford-Antalya/Bodrum precedent (Batch 6).** A genuine operator-name upgrade was found (Jet2
Holidays, TUI), so `verifiedDate` was updated to reflect it -- but no duration, frequency or
seasonality signal exists on the page to support classifying this record as either STABLE or
RECENT/CHANGING, so `reviewDueDate` was deliberately left at its existing 2026-09-12 date rather
than recalculated from the new `verifiedDate`, exactly matching the reasoning already established
for its sibling records.

**Leeds Bradford-Antalya and -Bodrum were rechecked and found identical to the 4 September check** --
no genuine new fact, so per this policy's own precedent (a reconfirmation without new evidence does
not meet the bar for a fresh `verifiedDate`), both were left completely untouched.

**London Gatwick-Marrakech and -Agadir**: fresh research was attempted (Gatwick's own "Browse all
destinations" link now resolves to a third-party booking aggregator rather than an official
destination page; direct URL attempts at easyJet, TUI and British Airways route-specific pages did
not resolve). The only Marrakech/Agadir-specific evidence found was the same static Gatwick press
release already dated 19 May 2025 and already correctly ruled inadequate for Agadir in Batch 6 -- the
identical reasoning now applies to Marrakech too. Both records are left completely untouched rather
than administratively extended.

**London Heathrow-Casablanca -- a genuine volatility signal, not a contradiction.** Royal Air
Maroc's own live "from London" booking page still shows a genuine current LHR-CMN fare today,
reconfirming Heathrow service continues to exist. But the same live page now shows Stansted (STN)
and Gatwick (LGW) city-pair labels far more often (9 and 5 occurrences respectively, versus 1 for
LHR, at a lower price point) -- a materially new observation not previously recorded, suggesting the
airline may now be prioritising other London airports over Heathrow for this route. This does not
contradict the current Heathrow claim, so it was not reclassified DISPUTED, but the shorter
RECENT/CHANGING window reflects the genuine new uncertainty this represents. Heathrow's own
airline/terminal listing (the prior corroborating source) 404'd on every URL attempted this session
and was not independently re-checked.

### Batch 5 -- 8 September 2026 (12 September final five)

Batch 4 left five routes genuinely unresolved rather than administratively extended: three
Leeds Bradford Turkey routes with evidence too thin to classify, and two Gatwick Morocco routes
backed only by a stale 19 May 2025 press release. This batch resolves all five with genuinely live,
current operational evidence rather than re-reading the same static pages:

| Route | Outcome | New window |
|---|---|---:|
| Leeds Bradford-Antalya | **Resolved -- live departures board confirms flight LS213 (Jet2), today** | RECENT/CHANGING, 30d |
| Leeds Bradford-Dalaman | **Resolved -- live departures board confirms flight LS413 (Jet2), today** | RECENT/CHANGING, 30d |
| Leeds Bradford-Bodrum | **Resolved -- live departures board confirms flight LS215 (Jet2), today; Jet2 named for the first time** | RECENT/CHANGING, 30d |
| London Gatwick-Marrakech | **Resolved -- live flight-search system confirms two easyJet flights (EZY8705, EZY8709), today; easyJet named for the first time** | RECENT/CHANGING, 30d |
| London Gatwick-Agadir | Genuinely live search attempted, found zero flights today -- left to fail closed, not administratively extended | unchanged (2026-09-12) |

**The key evidence source: Leeds Bradford Airport's own live departures board
(leedsbradfordairport.co.uk/flights/departures) and London Gatwick's own live flight-search system
(gatwickairport.com/flights?destination=D), both queried directly today rather than re-reading
static marketing pages.** These are exactly the cadence policy's "airport official current flight
board" evidence category -- a real, timestamped, numbered scheduled flight is materially stronger
continuity evidence than a "Book with X" link, because it proves the service is actually operating
today, not merely that the airport's marketing page still lists the destination.

**London Gatwick-Agadir remains genuinely unresolved, and this is the correct outcome, not a stalled
one.** A real, current, live search (both the exact term "Agadir" and the partial term "Agad")
returned zero matching flights today on the same system that successfully confirmed
london-gatwick-marrakech the same session. This does not prove the route no longer operates -- an
unmatched single day on a leisure route that may not fly daily is not proof of non-operation -- but
it also does not positively reconfirm it. Per this policy's own rule, a route that cannot be
reconfirmed is never administratively extended: the record is left to fail closed on its existing
2026-09-12 date.
