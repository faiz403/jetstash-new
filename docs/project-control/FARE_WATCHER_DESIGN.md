# Fare Watcher / Standout Fares — Design Brief

Status: Phase 1 foundation implemented on `feature/fare-watcher-phase-1`.
The engine is internal-only: no monitoring, scraping, automatic approval or
automatic publication is approved.

## Purpose

Identify internal candidates when a legitimate fare feed or partner API shows a
meaningful change against a consistent JetStash search profile. A candidate is
an editorial lead, not a customer-facing claim.

## Evidence and inputs

- Use only approved airline, metasearch API, affiliate-feed or partner-feed
  sources whose terms permit this use.
- Never scrape Google Flights, Skyscanner, Trip.com or other consumer pages.
- Keep one versioned search profile per route: passenger count, cabin,
  travel dates or horizon, baggage assumptions and currency.
- Store the checked timestamp, source, exact dates, fare, routing and evidence
  limits for every observation.

## Candidate flow

1. A permitted feed produces an observation matching a profile.
2. The system compares it with the route's recent median and recent low only
   when the comparison window and sample size are explicit.
3. It creates an internal candidate alert with the raw evidence and reason,
   such as below-median fare or unusual routing change.
4. A founder/editor rechecks the source manually and approves, edits or rejects
   the candidate.
5. Approved observations may enter the append-only archive; nothing publishes
   automatically.
6. Candidates expire automatically when their checked date, travel dates or
   source availability no longer support the claim.

## Phase 1 qualification rules

The pure comparator lives in `lib/fare-watcher.ts`. It only compares records
that share the same route, cabin, GBP currency, versioned `profileId`, passenger
profile, trip length and an eight-week-style booking horizon (up to seven days'
drift). A same-day alternative is part of the same search snapshot, not a
baseline point. Historical records, incomplete records and records outside the
180-day baseline window are excluded and reported as evidence limits.

The initial archive is thin: most routes have one observation and only a small
number have repeated same-profile observations. The first bar is therefore a
minimum of **three comparable prior observations**, a current candidate, and a
drop of at least **£25 and 10% below the prior median**. A new recent low that
does not clear both meaningful-drop thresholds is labelled `new-recent-low`,
not a stronger public claim. A candidate that clears both thresholds and is a
new low is an internal `standout-candidate`; otherwise it is `notable-drop` or
`ordinary-fare`. Zero candidates is a valid result.

Every generated candidate starts at `detected`, carries
`founderVerificationRequired: true`, and must move through
`needs-verification` and founder approval before it could ever become eligible
for publication. Expiry is fail-closed when the observation is stale or the
travel date has passed. The engine never emits a market-wide cheapest, bargain,
guaranteed, urgency or savings claim, and it never changes the append-only
archive itself.

The real archive audit for 11 August 2026 produced no candidates. On
Manchester–Islamabad, the two explicitly current Turkish snapshots have a
three-point comparable prior baseline (Â£524, Â£562, Â£621; median Â£562), so
Â£621 and Â£626 are ordinary fares under this first threshold set. The Etihad
Â£645 row is explicitly historical and excluded.

## Future provider boundary

`lib/fare-source-adapter.ts` defines a typed, unimplemented adapter boundary:
`searchRoute`, `normaliseOffer` and `recheckOffer`, plus source terms metadata.
No consumer-page scraping or unapproved external API is connected. A future
adapter must prove permitted usage, preserve the same profile fields, and feed
the append-only observation archive rather than bypassing it.

## Guardrails

- Do not call a fare a deal, standout, cheapest or best without an approved
  definition and sufficient evidence.
- Unknown baggage, seat fees and mandatory charges remain unknown.
- A feed alert never changes route truth, Book By, Travel Ready or affiliate
  links.
- The public surface must show observation date and limitations, not a live-price
  promise.

## Open decisions before implementation

- Which permitted provider supplies stable API/feed access and usage rights?
- Minimum sample size and comparison window for each route profile.
- Candidate retention and audit-log location.
- Founder approval workflow and notification channel.
