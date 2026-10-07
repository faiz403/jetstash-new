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
180-day baseline window are excluded and reported as evidence limits. **A
methodology-excluded observation** (`data/fare-observations.ts`'s
`methodologyExcludedObservationIds`, checked via the exported
`isMethodologyExcluded()`) **is excluded too, added 22 August 2026** — an
observation whose retained itinerary evidence is insufficient to confirm
ticketing structure must not influence a baseline median or previous-low
figure, or itself become a candidate, any more than it may appear on the
public Fare Signal. This mechanism postdates the original Phase 1 rules
above and was not threaded through until a Fare Watcher Methodology-
Exclusion audit found it silently entering baselines (see PR #164).

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

### Self-transfer / separate-ticket fares are never a candidate (FWATCH-ST-001, 7 October 2026)

The weekly archive records a flagged self-transfer / separate-ticket secondary beside the clean fare for the
same route and date, and older observations may carry the same evidence in `priceNote`. That evidence is read
only through the existing `isSelfTransferItinerary()` detector (`lib/fare-self-transfer.ts`); Fare Watcher
adds no second classifier. Three narrow rules apply:

1. **Same-day selection.** When a clean observation and a self-transfer observation share the observation day,
   the clean one is preferred before price, so a cheaper flagged fare cannot displace it as the detection.
2. **A self-transfer observation is never itself a candidate.** It still takes part in "latest observation"
   selection, so a newer self-transfer-only snapshot retires (supersedes) an older clean lead instead of
   letting a stale clean fare resurface.
3. **A self-transfer recheck is never the evaluated fare of a candidate.** A candidate whose latest matching
   recheck is self-transfer is retired, not evaluated on the flagged price; on the same day a clean recheck
   outranks a flagged one.

Deliberately **not** changed: the comparable baseline (self-transfer observations still count as baseline
points), medians, previous lows, the £25 / 10% thresholds, the three-point minimum, booking-horizon rules,
qualification tiers, lifecycle, the Standout contract and approvals.

**What the fix guarantees, and what it does not.** On the current JetStash archive the fix only removes
misleading candidates; this is checked on every day from 11 August to 7 October 2026 in
`tests/fare-watcher-self-transfer-boundary.test.ts`. It is not a universal guarantee. Same-day clean and flagged
pairs from the weekly sweep normally share travel dates, so their qualification context is unchanged and only
the detection's identity switches from the flagged fare to the clean one. In the general case, if a same-day
clean and flagged observation have different travel dates, preferring the clean observation can change the
qualification baseline and may produce a different candidate outcome, including a candidate that the flagged
observation would not have produced; a boundary test documents this limit without endorsing it.

Whether self-transfer points should leave the baseline is a separate methodology decision
(`FWATCH-BASELINE-001`). Observations whose `priceNote` does not state their booking structure cannot be
identified by this rule.

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
