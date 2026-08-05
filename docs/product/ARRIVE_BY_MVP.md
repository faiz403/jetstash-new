# Arrive By — Stage 1 MVP (engine) + Stage 2 (private founder preview)

**Status:** Stage 1 complete — pure calculation/recommendation engine, comprehensive deterministic
tests. Stage 2 complete — a private, founder-only preview interface at `/founder/arrive-by`
(`app/founder/arrive-by/page.tsx`, `components/founder/arrive-by-preview.tsx`), gated exactly like
`/founder` and the Journey Brief preview (404s in production unless `FOUNDER_DASHBOARD_ENABLED=true`,
`robots: {index:false, follow:false}`, absent from `app/sitemap.ts`, no analytics, no external
requests). **This remains private and unindexed — it is a product-evaluation tool, not a
customer-facing release, and does not indicate public launch readiness.** Stage 3 (public
integration) is explicitly not started — see §17. See §16 for what Stage 2 actually built and a
defect it surfaced in Stage 1's own output; §17 for what Stage 3 would still need.

**Relationship to `docs/project-control/ARRIVE_BY_SPEC.md`:** that document specifies a fuller,
"evidence-gated" feasibility engine — live schedule sources, ground-transport estimates, a
timestamped audit trail per candidate journey — and its own text says implementation "remains
deferred until schedule and ground-transport sources can support honest estimates." This MVP is a
**deliberately different, smaller product** that sidesteps that exact blocker: it never claims to
have searched a live schedule at all. It answers a narrower question — "what's a sensible planning
window, given what JetStash already knows about this route?" — using only data JetStash already
holds (Route Status) plus openly documented, adjustable planning assumptions. It is not a
step toward the evidence-gated spec by degrees; it is a different, more modest tool that happens to
share a name.

**Relationship to the LAUNCH-001 product freeze** (`docs/project-control/STATUS.md`): the founder's
30 July 2026 freeze pauses new customer-facing feature work during the soft-launch window. This
Stage 1 PR adds no customer-facing surface — no route, no navigation entry, no form, nothing
reachable from any page (`tests/arrive-by-integrity.test.ts` asserts this structurally: nothing
under `app/` or `components/` references `arrive-by`). It is reviewable, testable library code
sitting inert in the repository, exactly the shape of work the freeze doesn't need to block. Wiring
it to a real page is Stage 2, and is a founder decision, not an engineering one.

## 1. User problem

*"What sort of journey should I look for if I must reach my destination by a particular local date
and time?"* — a traveller working backwards from a deadline (a wedding, a flight connection, a
family event) rather than forwards from "when do I want to leave." They need a sensible planning
window, not a promise.

## 2. MVP scope (Stage 1)

- A pure, deterministic TypeScript engine (`lib/arrive-by/`) that computes an indicative
  backward-planning window from a required arrival date/time.
- A controlled initial set of six routes (§14), each already reliable in JetStash's existing Route
  Status data.
- A small, explicit, real IANA timezone mapping for exactly the airports/destinations supported.
- Comprehensive tests (30 requirement-mapped cases across four test files).
- This document.

## 3. Non-goals (Stage 1 and generally)

- **Not live flight search.** No airline, airport, Google Flights, Skyscanner, or Trip.com API is
  called. No network request of any kind (`tests/arrive-by-integrity.test.ts` asserts this).
- **Not a flight number or exact timetable generator.** The engine never fabricates a flight code,
  a specific seat, or a specific schedule slot (`tests/arrive-by-engine.test.ts`'s req-22 case).
- **Not a promise of arrival.** Every result carries an explicit disclaimer (§13) and uses words
  like "indicative," "estimated," and "planning window."
- **Not a Travel Ready Check.** No passport, visa, nationality, or other personal/document data is
  accepted or returned — that remains `lib/travel-ready-check.ts`'s job, entirely separate.
- **No public interface yet.** No route, page, component, form, analytics event, sitemap entry, or
  metadata is added in this PR.

## 4. Supported inputs

```ts
interface ArriveByInput {
  originAirportSlug: string;
  destinationSlug: string;
  requiredArrivalDateLocal: string; // destination-LOCAL calendar date, YYYY-MM-DD
  requiredArrivalTimeLocal: string; // destination-LOCAL 24h time, HH:mm — required, never defaulted
  deadlineStrictness: 'strict' | 'flexible';
  baggage: 'hand-luggage-only' | 'checked-baggage';
  connectionRiskPreference?: 'standard' | 'cautious'; // meaningful for connecting journeys only
}
```

No number-of-travellers, mobility, or reason-for-travel fields exist in this MVP (all present in
the fuller `ARRIVE_BY_SPEC.md` vision) — Stage 1 deliberately keeps the input contract to exactly
what the backward-planning arithmetic needs, nothing more.

## 5. Result states

```ts
type ArriveByResultState =
  | 'ready_for_planning'        // full plan, normal confidence
  | 'limited_confidence'        // full plan, reduced confidence, with a stated reason
  | 'route_verification_required' // no plan computed — the service isn't confirmed for this date
  | 'unsupported_route'
  | 'invalid_deadline'
  | 'insufficient_timezone_data';
```

A `ready_for_planning`/`limited_confidence` result (`ArriveByPlan`) returns: route identity, journey
type, confidence, the required arrival (local + UTC), recommended latest landing (local + UTC), an
indicative UK departure window (earliest/latest, local + UTC), a recommended UK-airport-arrival time,
a departure-timing bucket, any preserved route warning, planning-model warnings, the assumptions
used, source provenance, and the disclaimer.

A `route_verification_required` result (`ArriveByRouteVerificationRequired`) returns route identity,
journey type, the required arrival, the preserved route warning, and the disclaimer — deliberately
**no landing or departure times**: inventing a backward-planning window for a service that isn't
confirmed to exist for the requested date would fabricate confidence the evidence doesn't support.

A rejection (`unsupported_route` | `invalid_deadline` | `insufficient_timezone_data`) returns just a
`reason` string and the disclaimer.

Every `ZonedDateTime` value in a result is explicit: `{ dateIso, timeHHmm, timeZone, utcIso }` —
local and UTC are never conflated, and every value states which IANA zone it's in.

## 6. Planning assumptions

All in `lib/arrive-by/config.ts`, each with a name, a value, and a plain-English rationale
(`assumptionsUsed` in every plan echoes the ones actually applied):

| Assumption | Value | Why |
|---|---|---|
| Indicative direct journey duration | 6.5–10.5 hours | Typical range across JetStash's direct network (Dubai shortest, Lahore/Islamabad longest); the upper bound is used for backward planning so the recommendation errs early. |
| Indicative connecting journey duration | 11–18 hours | Typical one-stop range via a Gulf/South Asian hub, before the separate connection buffer. |
| Destination processing buffer | 45 min | Disembarkation, immigration where applicable, reaching the exit. |
| Checked-baggage destination buffer | +35 min | Carousel wait, on top of the above. |
| Strict-deadline schedule-risk buffer | 60 min | Larger cushion before a must-not-miss deadline. |
| Flexible-deadline schedule-risk buffer | 20 min | Smaller cushion — some genuine slack already exists. |
| Standard connection buffer | 90 min | A customer-facing planning cushion for one connection — not an airline minimum-connection-time claim. |
| Cautious connection buffer | 150 min | Replaces the standard buffer when the traveller prefers not to risk a tight connection. |
| Checked-baggage connection buffer | +30 min | Bags must transfer airside between flights. |
| UK airport preparation (hand luggage) | 120 min | Reaching the airport, security, gate. |
| UK airport preparation (checked baggage) | 180 min | The above plus bag-drop queuing. |
| Overnight-warning threshold | 15 hours | A connecting total (duration + buffer) at or above this gets an explicit overnight-departure warning. |
| Evening-departure threshold | 17:00 | A recommended UK departure at/after this hour, one day before the deadline's UK-equivalent date, is labelled "previous evening" rather than "previous day." |

Every one of these is a **planning assumption**, adjustable in one place, and structurally distinct
from a **verified JetStash route fact** (route.flightTime, Route Status, verification records) —
see §6.1.

### 6.1 Why duration is a config-level range, not a per-route parsed figure

`route.flightTime` (e.g. `"7h 45m direct"`, `"Journey duration varies by connection and has not
been independently established."`) is free text written for a human reader, not for arithmetic —
its wording can and does change without notice, and parsing it at runtime would silently break the
moment a sentence changes shape. The engine never parses it. It uses one documented range per
journey type instead, and separately surfaces the route's real `flightTime` text, verbatim, as
context (`routeFlightTimeText` in route-support, shown but never computed with). This keeps a
verified fact and a planning assumption visibly distinct, exactly as required.

## 7. Direct-route logic

1. `recommendedLatestLandingLocal` = required arrival − (destination processing buffer [+ checked
   baggage] + schedule-risk buffer [strict/flexible]).
2. `indicativeUkDepartureWindow.latest` = recommended latest landing − indicative direct duration
   (upper bound).
3. `recommendedOriginAirportArrivalLocal` = that departure − UK airport preparation allowance
   [hand luggage/checked baggage].
4. `indicativeUkDepartureWindow.earliest` uses the same landing time minus the duration range's
   **lower** bound, giving the window real width rather than a single instant.

## 8. Connecting-route logic

Same shape as §7, with two differences:

- The indicative duration uses the connecting range (11–18h), and a **connection buffer** is added
  on top: standard (90 min) or cautious (150 min), plus +30 min if checked baggage.
- If the total indicative duration (upper-bound flight time + connection buffer) reaches the
  15-hour overnight threshold, an explicit planning warning is added — Manchester–Dhaka, the one
  connecting route in the initial set, sits well past this threshold once any buffer is added.

## 9. Strict versus flexible deadlines

Only affects the schedule-risk buffer (§6) — strict gets 60 minutes of protection before the
deadline, flexible gets 20. This is the one place "how much do I trust this deadline number" is
modelled; it never changes journey duration or connection assumptions.

## 10. Hand luggage versus checked baggage

Affects three independent places: the destination-side buffer (+35 min), the connection buffer for
connecting journeys (+30 min), and the UK airport preparation allowance (120 → 180 min). Each is
named and shown separately in `assumptionsUsed` — never folded into one opaque "baggage buffer."

## 11. Timezone approach

**No file in this codebase carried IANA timezone data before this PR** — confirmed by inspection:
neither `data/airports.ts` nor `data/destinations.ts` has a timezone field, and the one existing
date-formatting helper (`lib/route-status-copy.ts`'s `formatDate`) only ever formats a date-only ISO
string with a fixed `T12:00:00Z` anchor, never real local-time arithmetic. This is genuinely new
ground for the codebase.

`lib/arrive-by/timezones.ts` adds:

- A small, explicit map — UK airport slug → IANA zone (currently just `manchester` → `Europe/London`,
  since every Stage 1 route is ex-Manchester) and destination slug → IANA zone (six real, well-known
  identifiers: `Asia/Dubai`, `Asia/Karachi`, `Asia/Dhaka`, `Asia/Kolkata`). Never a fixed UTC offset.
- Conversion functions built directly on `Intl.DateTimeFormat` (ECMA-402) — no timezone library was
  added. Node ships full ICU data by default in every version this project targets, so `Intl`
  already resolves any real IANA zone correctly, including its historical/future DST transitions.
  **If a future stage needs materially broader IANA coverage than a short explicit map can
  reasonably hold, that is the point to stop and ask before adding a dependency — not yet reached
  here.**
- `zonedTimeToUtc` handles both directions of travel (east/west date changes fall out naturally from
  real epoch-millisecond arithmetic — no special-casing needed) and daylight-saving, including
  correctly detecting the two genuinely ambiguous cases: a skipped "spring forward" hour and a
  repeated "fall back" hour, both flagged via `dstTransitionAmbiguous` rather than silently guessed.
- An unmapped or unresolvable airport/destination returns `null` from the lookup — the engine then
  returns `insufficient_timezone_data` rather than falling back to a guess. Every Stage 1 supported
  route has a real mapped timezone by construction (`tests/arrive-by-route-support.test.ts` asserts
  this), so this path is exercised directly at the `timezones.ts` unit level
  (`tests/arrive-by-timezones.test.ts`) rather than being reachable through the engine today — it
  exists as a safety net for the day a route is added to the supported set without its timezone
  entry.

## 12. Withdrawal and Verification Pending handling

The engine never assumes a service continues past a date it has itself announced as ending, and it
never fabricates a new claim about why — it always defers to the exact wording already recorded in
the Route Status ledger (`data/route-status-events.ts`).

- **Route currently `unverified`** (a route with `isDirect: true` whose verification has expired, or
  a ledger-managed route with no current claim) → `route_verification_required`, journey type
  `verification-pending`. No numbers are computed.
- **Route currently `service-ended`** (a verified ledger event proves the service genuinely stopped)
  → `route_verification_required`, journey type `service-ended`.
- **Travel date on/after an announced withdrawal's effective date** (even if today's status is still
  `direct`) → `route_verification_required`. This mirrors the ledger's own core invariant exactly:
  an announcement's effective date passing produces verification-pending, never a silent transition
  to "ended" — applied here to a *future requested travel date*, not just to "now." (An event
  already verified as `service-ended` still maps to `service-ended`, since that fact genuinely is
  confirmed, not merely announced.)
- **Travel date before an announced withdrawal's effective date** → a full plan is still returned
  (`limited_confidence`, not blocked), with the ledger event's own customer-facing `headline`
  carried through as `routeWarning`, verbatim. The traveller gets a real, usable plan plus an honest
  heads-up — never a suppressed warning, never an invented one.

**Manchester–Delhi and Manchester–Mumbai are both genuinely withdrawal-announced** (IndiGo,
effective 2026-08-31 — see `data/route-status-events.ts`). The original brief named Mumbai as
conditional on honest withdrawal handling; this build applies the identical logic to Delhi too,
since the underlying evidence is identical. Neither route is a special case in the code — both flow
through the same generic boundary-comparison logic as every other supported route.

**A connecting route (`isDirect: false`) is not staleness-gated the same way.** Per
`getDisplayDirectness`'s own documented invariant (`data/routes.ts`), "connecting" is treated as a
recorded shape decision, not a claim requiring an expiring verification window — so
Manchester–Dhaka's `journeyType` stays `'connecting'` regardless of its `verification.reviewDueDate`.
Its route-specific caveat (a documented history of suspension and relaunch) still surfaces
separately when applicable, via `routeWarning`, sourced from an active `RouteWarning` record if one
exists.

## 13. Safety and wording rules

Every result — success or rejection — carries this disclaimer verbatim
(`NON_LIVE_SCHEDULE_DISCLAIMER` in `config.ts`):

> This is an indicative planning window, not a live schedule search. It does not confirm that a
> specific flight, seat, fare, or connection is available, and it does not guarantee arrival by
> your deadline. Check live schedules directly with the airline or a booking site before
> travelling.

The engine never generates a flight-number-shaped token, never claims a specific seat or fare, and
never asserts that live schedules were searched (`tests/arrive-by-engine.test.ts`'s req-22 case
checks this structurally against the actual output, not just against the prose).

## 14. Initial supported routes

| Route | Journey type (as of Aug 2026) | Why chosen |
|---|---|---|
| Manchester–Lahore | Direct, verified | Flagship, well-evidenced South Asia direct route; existing verification record with a clear review cadence. |
| Manchester–Islamabad | Direct, verified | Same basis as Lahore — a second clean, well-evidenced direct example. |
| Manchester–Dubai | Direct, verified | A shorter-haul Gulf direct route (Emirates) — demonstrates the duration range genuinely spans more than one destination profile. |
| Manchester–Dhaka | Connecting, verified | The one real connecting example with solid current evidence (Biman's official notice) — exercises the connection-buffer logic on real data, not a synthetic case. |
| Manchester–Delhi | Direct, withdrawal-announced | Exercises the withdrawal-boundary logic honestly; included on exactly the same footing as Mumbai (see §12), not a lesser one. |
| Manchester–Mumbai | Direct, withdrawal-announced | As named in the brief — its withdrawal state is clearly surfaced, never implying post-withdrawal availability. |

Deliberately excluded from Stage 1: Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad
(explicitly unresolved PIA disputes — see `STATUS.md`'s `COV-001`), and every non-Manchester
origin (no other UK airport has a timezone entry yet, since none was needed for this route set).

## 15. Future live-schedule integration boundary

If a later stage adds a real schedule/availability source, it must be a clearly separate input to
this engine (or a distinct engine entirely), never a silent upgrade of the duration-range
assumptions in `config.ts` to "verified." The moment a specific flight, seat, or timetable slot is
asserted, the product has crossed into `ARRIVE_BY_SPEC.md`'s evidence-gated territory and inherits
its data/architecture gates (permitted schedule source, connection/terminal assumptions, ground
transport, an audit trail per result) — none of which this MVP needs or claims to have met.

## 16. Stage 2 — private founder preview (built)

A private, founder-only preview at `/founder/arrive-by` (`app/founder/arrive-by/page.tsx`,
`components/founder/arrive-by-preview.tsx`) — a form (route/date/time/planning-preference/baggage,
plus connection-risk-preference shown only for the one connecting route) and a plain-language result
view rendering `ArriveByPlan`/`ArriveByRouteVerificationRequired`/rejection states, backed entirely
by `lib/arrive-by/founder-preview.ts`, a thin presentation layer over the unmodified Stage 1 engine
(route/timezone/config/engine files untouched). No analytics event, no network call, no
`localStorage` — every plan is computed in the browser from the six-route closed set and discarded
on navigation. Access, indexing and public-surface protection mirror `/founder` and the Journey
Brief preview exactly (see the Status line above). This is a product-evaluation tool for the
founder, not Stage 3's public interface — see §17 for what that would still need.

**Stage 1 defect discovered while building this (reported, not silently patched):**
`ArriveByPlan.indicativeUkDepartureWindow.earliest`/`.latest` are named backwards relative to real
chronological order — `.earliest` is computed from the shorter duration bound (closer to the fixed
landing time, so a *later* clock time) and `.latest` from the longer bound (further from landing, so
an *earlier* clock time). Because every duration range in `config.ts` has min < max, `.earliest` is
chronologically after `.latest` for every request, not an edge case — confirmed directly against
real engine output for both a direct (Lahore) and connecting (Dhaka) example. `lib/arrive-by/engine.ts`
and `types.ts` are untouched; the founder preview works around it for display only via
`chronologicalDepartureWindow()` in `founder-preview.ts` (tests: "DISCOVERED STAGE 1 DEFECT" in
`tests/arrive-by-founder-preview.test.ts`). Renaming the two fields directly in Stage 1 — the
obviously correct real fix — is left for the founder to approve and schedule, not bundled into this
PR silently.

## 17. Stage 3 production-release checklist (not built in this PR)

Before any public release: visual/functional QA once a UI exists; real usage validation that the
planning windows read as helpful rather than alarming; a decision on whether `SUPPORTED_ROUTE_SLUGS`
should grow beyond six and what evidence bar a new route must clear first; confirmation that
`config.ts`'s assumptions have been sanity-checked against real traveller feedback, not just
internal review; and explicit founder sign-off given the LAUNCH-001 soft-launch context this Stage 1
PR was built inside of.
