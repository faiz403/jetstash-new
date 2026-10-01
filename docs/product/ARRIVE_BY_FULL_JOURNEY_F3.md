# Arrive By full journey — F3 (composed internal API + internal UI)

Status: implemented on `feat/arrive-by-full-journey-f3` (from `300cae5`). **Internal only.** No public route, no
navigation, no sitemap entry, no release-table change, no worldwide rollout; the arrival-only `/arrive-by` product is
untouched (tests assert none of its files import the journey code). Earlier phases: `..._F0_F1.md`, `..._F2.md`.

## What F3 adds

- **`POST /api/founder/arrive-by-journey`** — the composed journey: start → departure airport → flight → arrival airport →
  final destination, through `planFullJourney` with ONE ledger (10 calls for the whole journey) and the monthly guard.
  Always LIVE (never accepts an entered origin duration); allow-listed body fields only; nothing stored, logged or sent
  to analytics.
- **`/founder/arrive-by-journey`** — the internal form. Question order: *Where are you starting from? → Which airport
  are you flying from? → When does the flight leave? → Where are you landing? → When does it land? → Where are you going
  after that?* Answer order: **"When should I leave?"** first, then the departure-airport line, then the final arrival,
  then the per-leg timeline with each leg's evidence and the internal call count. Confirmation / selection controls exist
  for **both** the start and the destination. The airport lists are computed on the server from the same evidence tables the
  API enforces (15 departure airports, 40 arrival airports) and passed as props, so the catalogue never reaches the client.

## Access model (a decision worth knowing about)

The founder flag alone is not enough for a deployed internal beta: the endpoint spends real Google money (~5 calls a
journey), so anyone who found the URL could run up the bill. In production it also needs a **server-side shared secret**:

1. `FOUNDER_DASHBOARD_ENABLED=true` (the existing founder gate; 404 otherwise)
2. `ARRIVE_BY_INTERNAL_TOKEN` set to a random string of at least 16 characters, sent as `x-arrive-by-internal-token`,
   compared in constant time (a missing, short or wrong token is the same byte-identical 404)
3. the product-wide rate limit (5 submissions / 60 s; counts submissions, not Google calls)
4. **durable shared call-budget storage configured**, else `503` and **not one Google call** is made
5. the monthly guard: reserve 10, settle to actual; alerts at 50% / 80% (a server log line with counts only, no journey
   detail); hard stop at 2,000

In `next dev` neither the flag nor a token is required (an `ARRIVE_BY_INTERNAL_TOKEN` that is set is still enforced) and the
in-process store is used. The UI keeps the token in component state only.

## Shared store (Upstash)

The real path is wired and tested end to end with a stubbed Upstash REST endpoint (reserve `+10`, settle `-6` for a 4-call
journey; outage refuses; 1,995 used refuses and refunds). It activates when `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` (or the Vercel KV names `KV_REST_API_URL` / `KV_REST_API_TOKEN`) exist.

**Not provisioned by me.** `vercel integration add upstash/upstash-kv` requires accepting the marketplace legal terms and
choosing a plan, which the CLI itself restricts to an interactive terminal with human confirmation. That is the one
unavoidable action: run it once (free plan is enough), link it to the `jetstash-new` project; it adds the env vars.
For a deployed internal beta also set `ARRIVE_BY_INTERNAL_TOKEN` and `FOUNDER_DASHBOARD_ENABLED=true` on a **Preview**
environment only, never Production.

## Verified live (dev, real Google, headless Edge, desktop and 390 px mobile)

Preston → MAN → ISB → Mirpur: "Leave Preston by around 07:50 / You should reach Manchester Airport with your chosen
2-hour buffer. / Expected final arrival: Mirpur around 02:40"; 5 of 10 calls (geocode 2, routes 3), search 2 queries,
converged. A venue start ("Preston Guild Hall") stopped at confirmation and completed after "Yes"; a Paris start was
refused as non-UK. Focus moved to the answer; no horizontal overflow.

## Not in F3

Any public exposure, a public URL or navigation, the flight lookup, transit legs, non-UK departures, Phase D.

## F3.1 — place-recovery blocker (fixed)

**Bug:** with a start needing selection and a destination needing confirmation ("Preston railway station" → "Atlantis The
Royal"), confirming one side brought the other side's prompt back, forever.

**Root cause:** the API is stateless and re-resolves BOTH places from text on every request, honouring only the place IDs sent
with that request. The first UI sent only the choice just made, so request 2 (start chosen) dropped the destination's pending
choice and request 3 (destination chosen) dropped the start's. The server was correct: the same two choices sent together
complete in one request. (`tests/arrive-by-journey-place-recovery.test.ts` reproduces the oscillation with an "old client" and
proves it.)

**Fix (client only; no server verification changed):** `lib/arrive-by-journey/place-recovery.ts` models `start` and
`destination` as independent choices (`confirmedPlaceId` | `selectedPlaceId`); every submission resends both; editing one side's
text invalidates only that side; changing the arrival airport to a different country invalidates only the destination; a side
the server sends back for recovery despite a supplied choice (stale/forged) is forgotten alone. The server still re-verifies
every ID against a fresh geocode each request and applies each side's country gate independently.

**Verified:** all combinations (start/destination × NEEDS_SELECTION / NEEDS_CONFIRMATION / RESOLVED, both resolve orders) complete
in 3 requests; live in dev with real Google, desktop and 390 px mobile: Preston railway station → MAN → DXB → Atlantis The Royal
(both orders), Royal Preston Hospital → Burj Al Arab (hospital + hotel), Preston railway station → KHI → Aga Khan University
Hospital (station + hospital). Worth knowing: each recovery step is a submission, so a two-prompt journey uses 3 of the 5-per-60-s
budget.

## F3.2 — trust and result clarity

Driven by the F4-S synthetic run (`ARRIVE_BY_F4S_SYNTHETIC_VALIDATION.md`). No external-user validation yet.

- **Resolved place shown for both ends (B1).** `plan.places.{start,destination}` carries what the traveller typed, a
  human label and Google's address. The result always shows "Start: … / Destination: …", so a silently accepted match is
  visible ("Newport, Wales, United Kingdom").
- **Recognisable recovery labels (B2).** `lib/arrive-by-shared/place-display.ts` (`describePlace`) builds the label from the
  Geocoding result we already pay for: a venue name only when Google supplied an establishment / point_of_interest / premise
  component (never a plus code, never invented), otherwise "kind at street, postcode, country" from Google's own types.
  Prompts read "You typed X. Google found <label>" with the full address as secondary text. **Limit:** Geocoding often has no
  venue name (Hilton Paddington, Royal Preston Hospital, Atlantis The Royal resolves to "Palm Jumeirah"). Fixing that fully
  needs the Places API (New) `displayName`, one extra billable call per place that needs recovery. Cost impact is not verified
  and it was NOT added; it needs an explicit decision and would touch the 10-call ceiling and the monthly guard.
- **Dates (S1).** `dateLabel` on leave / airport / final arrival plus `dayOffset` from the leave day; the UI writes "Wed 21 Oct
  (next day)" and dates any timeline leg that falls on another day. Arithmetic is unchanged; the date is read from the same
  5-minute-rounded instant as the clock.
- **CANNOT CONFIRM (S3).** No `headline`; the UI shows "We couldn't confirm this journey", says no leave time is shown, and lists
  only durations as "partial, not a confirmed plan".
- **Driving assumption (S2).** A one-line note under the start field and under the result: leave time assumes driving and excludes
  parking, drop-off, shuttle and rental-car return.
- **Unchanged:** server re-verification of every place id, forged/stale protection, the 10-call ceiling, the monthly guard. Place
  labels are not sent to analytics and not logged (asserted in `tests/arrive-by-journey-trust.test.ts`).

### F3.2 addendum: Places name fallback (presentation only)

`lib/arrive-by-journey/place-name.ts`. Geocoding stays the resolver and the source of truth; Places (New) Place Details with
`displayName` only is used purely to show a recognisable name in a confirm/select prompt.

- Called only for a place already in NEEDS_CONFIRMATION / NEEDS_SELECTION whose geocode had no venue name (`unnamed`), and only
  for the candidates actually shown. Never for a normal resolved place ("Newport, Wales, United Kingdom").
- Every call goes through the same `GoogleCallLedger` (10-call ceiling) and so the monthly guard. Affordability is checked before
  each call, so a refusal never trips the journey's exhaustion flag. Insufficient budget, a non-2xx, a network error or a malformed
  or plus-code name all fall back to the safe geocode label. A name is never invented.
- The name never affects safety: confirm/select re-verification still runs against a fresh geocode on the next request.
- UI: name on the first line, Google's area/address context beneath; the accepted name is kept for the final "Destination:" line.
- Opt-in per caller (`placeNames: 'LIVE'`, set only by the internal journey route); the public road engines are untouched.
- **Live-verified (local key, Places API (New) enabled and added to the key's API restrictions):** real names returned for Royal Preston Hospital, Serena Hotel, Hilton London Paddington, Radisson Blu Hotel Manchester Airport and Atlantis The Royal; a plain locality (Newport) made zero Places calls. A venue name that shares no meaningful word with what the traveller typed (Google's Palm Jumeirah for `Atlantis The Royal`) counts as unrecognisable and also triggers the lookup. Cost per call is unverified.
