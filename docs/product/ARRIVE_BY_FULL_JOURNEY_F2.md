# Arrive By full journey — F2 (live start → departure-airport leg)

Status: implemented on `feat/arrive-by-full-journey-f2` (from `f6337d8`), **library only**: no route, no UI, no
release, no flight provider, no Phase D. F1 doc: `ARRIVE_BY_FULL_JOURNEY_F0_F1.md`.

## What F2 adds

The missing half: `start → departure airport`, live from Google, replacing the entered `originLegMinutes`
(which survives only as an explicit internal `originMode: 'ENTERED'` opt-in and is **ignored** in the default
`LIVE` mode, never a silent substitute when routing fails).

1. **Start location** goes through the *same* resolver and confirm/select safety as the destination
   (`place-choice.ts`, extracted from the road engine, which now calls it too): UK gate, region bias `uk`, ambiguous /
   too-broad / non-UK starts are refused and never routed; forged or stale `startConfirmedPlaceId` /
   `startSelectedPlaceId` are re-verified server-side and cannot unlock anything.
2. **Trusted origin/target.** The start is routed from *Google's own coordinate* for the resolved place (never client
   coordinates): routing from a locality's name or place ID can return **no route at all** ("Durham" → `{}`), while
   its coordinate routes normally (found by the live probe; NCL failed until this was fixed). The airport target is
   the explicit profile coordinate where one exists (MAN Terminal 2), otherwise the catalogue coordinate.
3. **Bounded backward search** (`origin-search.ts`). DRIVE cannot be queried by arrival time, so find the largest T
   with `T + drive(T) <= D` (D = flight departure − chosen buffer) by the fixed-point map
   `T' = D − drive(T) − 2.5 min` (aim for the middle of the 5-minute window so a one-minute traffic wobble lands
   feasible instead of missing and costing another call). Seed = D − 60 min; stop when slack is within `[0, 5]`
   min; **at most 4 route queries**; keeps the latest *verified*-feasible departure and never reports an unverified
   time as safe; stops on a revisited point; clamps to now + 1 min (Google will not route the past) and reports
   `ALREADY_TOO_LATE` (→ NOT FEASIBLE) if even leaving now misses; FAILED → CANNOT CONFIRM. Exact epoch-ms
   arithmetic; the solver rounds the displayed leave time **down** to 5 minutes.
4. **One ledger for the whole journey.** The origin search is capped at `min(4, remaining − 2)` so the arrival side
   always keeps its 2 calls; the 10-call ceiling is unchanged and covers everything.

## Departure capability is directional

`departure-capability.ts` + `departure-capability-evidence.json`. Evidence means: identity verified **and** the
production origin search succeeded from a real UK start INTO the airport, in three time-of-day scenarios. It is
never inferred from arrival evidence: MAN is a public explicit profile with arrival capability, yet **without its own
departure entry it cannot be a live departure** (tested by deleting it). UK (`GB`) airports only.
A live origin needs departure evidence; otherwise `DEPARTURE_AIRPORT_NOT_EVIDENCED`, refused before any Google call or
monthly reservation.

One narrow, recorded rule: Google types **Manchester Airport** as a transit station, not an airport (as in Phase C).
For an airport with an **explicit profile** (MAN) whose profile coordinate was founder-validated, a strong name match
within 5 km is accepted and the evidence records the basis. **Bristol** (BRS) has the same Google typing but no explicit
profile, so it stays `NEEDS_REVIEW` with no evidence.

## Live evidence (operator probe, 1 Oct 2026, real Google)

`scripts/arrive-by-departure-probe.ts` ran the production origin search for 16 UK airports × 3 flights (06:00, 09:30,
18:00) plus 3 study probes. **15 airports earned departure evidence** (MAN, LHR, LGW, STN, LTN, BHX, EDI, GLA, NCL, LBA,
LPL, EMA, ABZ, BFS, CWL); BRS NEEDS_REVIEW. Nothing is released.

### Measured Google-call cost (53 successful scenarios)

| | median | worst | distribution |
| --- | --- | --- | --- |
| Origin side, total calls (1 geocode + route queries) | **3** | **4** | 2 calls ×3, 3 calls ×48, 4 calls ×2 |
| Route queries in the search | **2** | **3** | 1 ×3, 2 ×48, 3 ×2 |

53/53 converged within the 5-minute tolerance; verified spare time at the chosen leave time was 0.13–4.1 minutes.
With the arrival side (destination geocode + drive = 2 calls) a **normal whole journey is 5 calls, the worst observed
6**, and the hard bound is **7** (1 + 4 + 2) — comfortably inside the 10-call ceiling. Four live whole-chain runs
(Preston→MAN→ISB→Mirpur at two departure times, Camden→LHR→DXB→Sharjah, Falkirk→EDI→MAN→Sheffield) each used exactly 5.

## Not in F2

Public UI, an API route, transit origin legs, the flight-schedule provider, connections, non-UK departures, Upstash
provisioning (deferred to F3), any release. The 20-minute tight threshold remains provisional.
