# Arrive By full journey — F0/F1 (engine foundation)

Status: implemented on `feat/arrive-by-full-journey-f1` (from `5ac867a`), **library only**: no route, no UI, no
worldwide release, no live flight API. The arrival-only product is untouched (a test proves nothing under
`app/` or `components/` imports the new module). Architecture and founder decisions:
`ARRIVE_BY_FULL_JOURNEY_ARCHITECTURE.md` (branch `docs/arrive-by-full-journey-architecture`).

## F0 — the shared-storage decision for the 2,000-call monthly guard

The counter must be **atomic and shared across serverless instances**, so it cannot be in memory (the existing
rate limiter is per-instance and best-effort; that is acceptable for abuse reduction, not for a spend cap).

| Option | Verdict |
| --- | --- |
| **Upstash Redis via the Vercel Marketplace** (REST) | **Chosen.** `INCRBY` is exactly the atomic add needed; fetch-only, no new runtime dependency; also what "Vercel KV" exposes. |
| Vercel Edge Config | Rejected: read-mostly, writes are not atomic counters. |
| Vercel Blob | Rejected: no atomic increment. |
| Postgres | Rejected: new infrastructure and schema for one integer. |

`CallBudgetStore` has one method, `incrementBy(key, delta, ttl) -> newTotal`. Implemented:
`UpstashRedisCallBudgetStore` (REST pipeline INCRBY+EXPIRE; any failure throws), `InMemoryCallBudgetStore`
(tests / local dev, reports `durable = false`) and `getConfiguredCallBudgetStore(env)` which returns a store only
when `UPSTASH_REDIS_REST_URL/TOKEN` (or `KV_REST_API_URL/TOKEN`) exist.

**The guard fails closed.** No store, a non-durable store in production, or any store error means the Google-backed
check is refused (CANNOT CONFIRM), never run unmetered. **One human action is still needed before F3** (not F1):
provision Upstash Redis for the project and add those two env vars in Vercel. Nothing in F1 needs it.

Guard behaviour: a journey **reserves its worst case (10) up front and settles to the calls actually used**, so
concurrent journeys cannot overshoot; the cost is refusing up to 9 calls early near the limit. Key
`arrive-by:google-calls:YYYY-MM` (UTC month, 40-day TTL). Alerts at 50% (1,000) and 80% (1,600) fire **once per
month** across instances (a second counter acts as the once-flag); hard stop at 100% (2,000).

## Per-journey call accounting

`GoogleCallLedger(ceiling = 10)`: a drop-in `fetch` that counts every Google request by kind (geocode / routes /
identity / other) and **refuses the 11th without sending it**. The existing engines swallow network errors, so a
refusal is also recorded as `ledger.exhausted`, and the orchestrator reads that flag — an over-budget leg is never
trusted, even if the provider returned a number. `resolveDestination`, `computeDriveRouteFrom` and
`computeRoadJourney` gained an optional trailing `fetchImpl` (default: global fetch), so the existing engines are
reused unchanged and existing tests are unaffected. **Measured profile today: 2 calls per journey** (1 geocode +
1 route, arrival side); F2 adds the origin side.

The visitor rate limit (5 submissions / 60 s) is unchanged and is never charged for a journey's internal calls.

## Data model (`lib/arrive-by-journey/`)

`JourneyInput`: start (text) → `departureAirport` (UK, IATA) → manual `flight` (local departure/landing times,
optional declared connections) → `arrivalAirport` → `destination`, plus the traveller's own buffers
(`departureAirportBufferMinutes`, `arrivalExitMinutes`, `pickupWaitMinutes`, optional final deadline and readiness).
`originLegMinutes` is the F1-only entered start→airport estimate (F2 replaces it with a live leg).
`JourneyPlan`: `state` (POSSIBLE_WITH_MARGIN, POSSIBLE_BUT_TIGHT, NOT_FEASIBLE, CANNOT_CONFIRM, ESTIMATE_ONLY),
`leaveBy` (the headline), `airportArriveBy`, `flight`, `finalArrival`, `deadline`, a per-leg `timeline` where every leg
carries its evidence (`ENTERED` / `GOOGLE_ROUTES` with `checkedAt` / `ASSUMPTION`), the founder's three-line headline
copy, and `calls`.

## The pure solver

```
airportArriveBy  = flightDeparture - departureAirportBuffer
leaveBy          = airportArriveBy - originLeg           (rounded DOWN to 5 min: earlier is safe)
roadDeparture    = flightLanding + arrivalExit + pickupWait
finalArrival     = roadDeparture + arrivalLeg            (shown to nearest 5 min; arithmetic stays exact)
margin           = (finalDeadline - readiness) - finalArrival
```

Every local time is read in **its own airport's IANA zone**, and a **nonexistent (spring-forward) or ambiguous
(fall-back) local time is rejected**, not guessed. Landing must be after departure in real time (date line safe);
a flight over 36 h is treated as a typo. Margin >= 21 min is POSSIBLE WITH MARGIN, 0..20 is POSSIBLE BUT TIGHT
(threshold provisional, the existing constant), < 0 is NOT FEASIBLE. No deadline gives ESTIMATE_ONLY. A missing or
unproven leg gives CANNOT_CONFIRM while still showing whatever part *is* evidenced. A declared connection is
CANNOT_CONFIRM (V1 does not model connections).

## Airports

Departure: catalogue country `GB` only (Channel Islands / Isle of Man are GG/JE/IM, so excluded). Departure-side
*capability* is separate evidence proven in F2. Arrival: capability-approved airports (explicit profiles or
`road_supported`); `public` mode also requires release, which only the four explicit profiles have. **BEK stays
unsupported and LYR stays unresolved** (catalogued, no capability, refused).

## Not in F1 (F2 onward)

Google origin-side leg with backward departure-time search; departure-airport capability evidence; the composed API
route and internal UI; transit; flight-schedule adapter; connections; the Upstash provisioning; per-journey call
profile measurement on the origin side.
