# IndiGo Manchester post-withdrawal truth verification — 2 September 2026

**Scope:** Manchester–Mumbai (`manchester-mumbai`) and Manchester–Delhi (`manchester-delhi`), IndiGo's
direct widebody service. Run per the locked scheduled brief
(`indigo-withdrawal-verification-man-bom-del`), 2–3 days into the "2–3 September" recheck window
(the 31 August 2026 run — see `docs/project-control/STATUS.md` and the superseded memory note —
correctly returned INSUFFICIENT/FAIL-CLOSED, since 31 Aug was the announced effective date itself
and no retrospective confirmation could exist yet).

## A. Repo state

Branch `fix/indigo-manchester-service-ended-2026-09-02`, cut from `main` at `c20a787` (the Tuesday
full weekly refresh merge). Working tree clean, no unrelated dirty work. Unrelated worktrees
(`agent-af1f30501fe86cf98`, `kayak-affiliate-application-setup`) left untouched.

## B. Primary sources checked

1. **IndiGo's own live booking engine** (www.goindigo.in) — direct MAN-BOM/BOM-MAN and
   MAN-DEL/DEL-MAN searches, 27 October-1 October 2026 date range sampled via the full visible
   calendar strip.
2. **AeroRoutes** — an aviation-industry GDS/schedule-filing report (originally used to cross-check
   the June announcement) re-checked directly: confirms IndiGo filed to cancel both routes in the
   OAG/GDS, schedule removed 3 June 2026, effective 1 September 2026.
3. **Manchester Airport's own live departures board** — a same-day operational snapshot
   (Wednesday 2 September 2026), checked as corroboration only, never as the sole basis for either
   verdict.

Never used Trip.com, Google Flights or another OTA as proof of route truth.

## C. MAN→BOM verdict: **SERVICE ENDED CONFIRMED**

## D. MAN→DEL verdict: **SERVICE ENDED CONFIRMED**

## E. Exact evidence supporting each verdict

- **MAN→DEL / MAN→BOM (Manchester-origin, both routes):** every listed IndiGo booking-engine
  result, across the full visible 2 September–1 October 2026 date range, is **Sold Out**. Zero
  bookable IndiGo-sold inventory in either cabin, any date sampled.
- **DEL→MAN / BOM→MAN (India-origin, both routes):** exactly one bookable itinerary each. Expanding
  its fare details shows it is a **Turkish Airlines codeshare via Istanbul** — e.g.
  `DEL - IST | 6E 4268 (OPERATED BY TK AS 717)`, `IST - MAN | 6E 4081 (OPERATED BY TK AS 1995)` —
  IndiGo selling seats on a Turkish-operated routing, never IndiGo's own widebody aircraft. No
  IndiGo-operated (6E-operated) nonstop flight exists in either direction on either route.
- **AeroRoutes:** "Indian low-cost carrier IndiGo this week filed service changes to Manchester...
  Delhi – Manchester eff 01SEP26 3 weekly service cancelled. Mumbai – Manchester eff 01SEP26 4
  weekly service cancelled. Schedule filing in the OAG and GDS also removed as of 03JUN26."
- **Manchester Airport's live departures board (2 Sep 2026):** zero IndiGo (6E) departures among
  every scheduled Wednesday-morning flight; no Delhi or Mumbai destination departs Manchester at
  all that day on any carrier.
- **IndiGo's own press-release page:** the original 2 June 2026 release remains live, unretracted,
  unmodified — no update, correction or resumption announcement posted since.

No conflicting evidence found anywhere. No specific last-operating date is evidenced (the release
never stated one and no source pins an exact final flight), so none is recorded or inferred — the
new ledger events assert only that the direct service has verifiably ended as of the announced
effective date, never when the final flight actually operated.

## F. Current live JetStash state after the expiry boundary (before this fix)

Both routes had only a `withdrawal-announced` event with `currentClaimValidBefore: '2026-08-31'` —
the existing automatic fail-closed mechanism had already correctly expired that claim to
`verification-pending`/`transition-boundary-reached` with no deploy, exactly as designed. Route
pages, metadata, Atlas and the homepage flagship all correctly suppressed flightTime/frequency/
airline-as-current facts through that state.

## G. Stale-truth leakage found

**One**, confirmed and fixed: `lib/atlas-network-data.ts`'s `buildDestinationPoint()` only branched
on `status?.status === 'withdrawal-announced'` — a genuinely verified `'service-ended'` event (the
first this ledger has ever carried) fell through with **no override at all**, leaving
`flightTime: route.flightTime` as the raw, unfiltered string (`"9h 45m direct (currently)"` for
Manchester–Mumbai) next to a verdict still reading "Direct service not yet independently verified"
— live on the public homepage's Atlas visualization. This was never triggered before because no
route in the real dataset had ever reached `'service-ended'` status. Confirmed present in a real
production build (`.next/server/app/index.html`) before the fix, confirmed gone after it. No other
surface checked (route page, route index/cards, destination page, airport page, region hub,
metadata/OG) showed any stale Direct/IndiGo-as-current-operator/frequency/duration claim.

## H. Code change required? **YES**

## I. What changed

- **Branch:** `fix/indigo-manchester-service-ended-2026-09-02`
- **Files changed:**
  - [data/route-status-events.ts](data/route-status-events.ts) — added two `service-ended` events
    (`man-bom-indigo-service-ended-2026-09`, `man-del-indigo-service-ended-2026-09`),
    `verifiedOccurrence: true`, `effectiveFrom: '2026-08-31'` (the already-evidenced announced
    date — never inferred), `currentClaimValidBefore: '2027-03-02'` (6-month review horizon,
    matching the codebase's existing convention), each `relatedEventId`-linked back to its own
    `withdrawal-announced` event. Three new `SourceRef` constants for the booking-engine check,
    AeroRoutes' filing report, and Manchester Airport's departures board.
  - [lib/atlas-network-data.ts](lib/atlas-network-data.ts) — added the missing
    `status?.status === 'service-ended'` branch: overrides `verdict`, `detail`, `flightTime` and
    `serviceNotice` with the real evidence via `getRouteStatusCopy()`, instead of leaving the raw
    `route.flightTime` string in place.
  - Six test files updated for the evidence-driven consequences (real 31 Aug/15 Sep 2026 boundary
    dates now correctly resolve to `service-ended` rather than the announcement-only pending
    state; two dataset-wide safety-check counts shifted `unverified` 7→5 / `noFare` 7→9; one new
    Atlas regression suite locks in the leakage fix). No assertion loosened; every change traces to
    real new evidence or a genuine, previously-latent gap.
- **Exact behaviour changed:** both routes' Route Status now resolves to `'service-ended'` (not
  `'verification-pending'`) from 31 August 2026 onward (until the claim's own 2 March 2027 review
  horizon); every public surface correctly suppresses the former direct-service facts; Atlas no
  longer shows a stale duration/"(currently)" claim for either route.
- **Tests/results:** 2929/2929 passing (2922 baseline + 3 new assertions in `route-status.test.ts`
  + 4 new Atlas regression tests, net); `tsc --noEmit` clean; `next lint` clean; production build
  succeeds, 168 static pages; `git diff --check` clean.
- **Diff summary:** 8 files changed (2 source, 6 tests), ledger-only + one adapter fix, no route
  truth/fare/affiliate/Book-By/Journey Choice logic touched.

## J. Connecting-alternative question

Per `data/routes.ts`'s own documented design (Route Status V1 implementation addendum §4):
`canShowConnectingAlternative` stays `false` for a `'service-ended'` route by deliberate
architectural choice — "the direct service ended" and "a connecting journey exists" are separate
facts requiring separate evidence, and this verification proves only the former.

**Would showing the already-evidenced one-stop alternatives materially help customers without
weakening the evidence model?** Possibly yes for these two specific routes — real connecting
options plainly exist (the India-origin direction is itself now sold as a Turkish Airlines
codeshare, and both `manchester-mumbai`/`manchester-delhi` likely carry existing
`connectingAlternative` records from before the direct service existed). But changing
`canShowConnectingAlternative`'s behaviour for `'service-ended'` would **broaden it for every
current and future service-ended route in the codebase**, not just these two — a real blast-radius
question the brief explicitly flags, not a two-line fix. Per the brief's own instruction, this is
**not implemented here**. Recommend a separate, dedicated PR that: (1) re-verifies each affected
route's `connectingAlternative` record is itself still current evidence (not stale pre-withdrawal
copy), and (2) makes a deliberate product decision on whether "direct service ended" pages should
surface connecting alternatives generally, rather than deciding it as a side effect of this
verification.

## K. Final recommendation

**APPROVE FOR FOUNDER REVIEW**
